# ml/email_trainer.py
"""
Email-to-ML Training Workflow
Automatically pull client quotes from Gmail/M365, parse them, and train ML models.
"""

import os
import re
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Union
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import psycopg
from pdf_parser import parse_client_quote_from_text, extract_text_from_pdf_bytes
from db_config import DatabaseManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class EmailQuote:
    """Represents a client quote found in email"""
    message_id: str
    subject: str
    sender: str
    recipient: str
    date_sent: datetime
    attachment_name: str
    attachment_data: bytes
    pdf_text: str
    parsed_data: Dict[str, Any]
    confidence: float

class EmailTrainingWorkflow:
    """Main workflow for email-based ML training"""
    
    def __init__(self, db_url: str, tenant_id: str):
        self.db_manager = DatabaseManager(db_url)
        self.tenant_id = tenant_id
        self.email_service = None
        
    def setup_email_service(self, provider: str, credentials: Dict[str, Any]):
        """Setup email service (Gmail or M365)"""
        if provider.lower() == "gmail":
            self.email_service = GmailService(credentials)
        elif provider.lower() in ["m365", "outlook", "office365"]:
            self.email_service = M365Service(credentials)
        else:
            raise ValueError(f"Unsupported email provider: {provider}")
    
    def find_client_quotes(self, days_back: int = 30) -> List[EmailQuote]:
        """Find emails with client quote attachments"""
        if not self.email_service:
            raise RuntimeError("Email service not configured")
        
        # Search for emails with quote attachments
        since_date = datetime.now() - timedelta(days=days_back)
        
        quote_keywords = [
            "estimate", "quotation", "proposal", "quote",
            "joinery", "windows", "doors", "timber", "carpenter",
            "price", "cost", "attachment", "pdf"
        ]
        
        # First try sent emails (client quotes we generated)
        emails = self.email_service.search_emails(
            keywords=quote_keywords,
            has_attachments=True,
            since_date=since_date,
            sent_only=True  # Only emails we sent to clients
        )
        
        # If no sent emails found, also check received emails for debugging
        if not emails:
            logger.info("No sent emails with quotes found, checking received emails for debugging...")
            emails = self.email_service.search_emails(
                keywords=quote_keywords,
                has_attachments=True,
                since_date=since_date,
                sent_only=False
            )
        
        logger.info(f"Found {len(emails)} emails matching quote criteria")
        
        client_quotes = []
        
        for email in emails:
            # Check if email has PDF attachments
            attachments = email.get("attachments", [])
            logger.info(f"Email '{email.get('subject', 'No subject')}' has {len(attachments)} attachments")
            
            for attachment in attachments:
                filename = attachment.get("filename", "").lower()
                logger.info(f"Processing attachment: {filename}")
                
                if filename.endswith(".pdf") or "pdf" in filename:
                    try:
                        quote = self._process_email_attachment(email, attachment)
                        if quote and quote.confidence > 0.1:  # Very low threshold for debugging
                            client_quotes.append(quote)
                            logger.info(f"Added quote with confidence {quote.confidence}")
                        else:
                            logger.info(f"Quote rejected - confidence too low or processing failed")
                    except Exception as e:
                        logger.error(f"Error processing attachment {filename}: {e}")
                else:
                    logger.info(f"Skipping non-PDF attachment: {filename}")
        
        logger.info(f"Found {len(client_quotes)} client quotes from last {days_back} days")
        return client_quotes
    
    def _process_email_attachment(self, email: Dict[str, Any], attachment: Dict[str, Any]) -> Optional[EmailQuote]:
        """Process a single email attachment"""
        try:
            # Download attachment data
            attachment_data = self.email_service.download_attachment(
                email["message_id"], 
                attachment["attachment_id"]
            )
            
            # Extract text from PDF
            pdf_text = extract_text_from_pdf_bytes(attachment_data)
                
            if not pdf_text:
                return None
            
            # Parse client quote data
            parsed_data = parse_client_quote_from_text(pdf_text)
            
            # Create EmailQuote object
            return EmailQuote(
                message_id=email["message_id"],
                subject=email["subject"],
                sender=email["sender"],
                recipient=email["recipient"],
                date_sent=datetime.fromisoformat(email["date_sent"]) if isinstance(email["date_sent"], str) else email["date_sent"],
                attachment_name=attachment["filename"],
                attachment_data=attachment_data,
                pdf_text=pdf_text,
                parsed_data=parsed_data,
                confidence=parsed_data.get("confidence", 0.0)
            )
            
        except Exception as e:
            logger.error(f"Error processing email attachment: {e}")
            return None
    
    def map_to_questionnaire_features(self, quotes: List[EmailQuote]) -> pd.DataFrame:
        """Map parsed quote data to ML training features"""
        training_data = []
        
        for quote in quotes:
            parsed = quote.parsed_data
            questionnaire = parsed.get("questionnaire_answers", {})
            project_details = parsed.get("project_details", {})
            
            # Map to ML features
            features = {
                # Core questionnaire features
                "project_type": questionnaire.get("project_type", "unknown"),
                "materials_grade": questionnaire.get("materials_grade", "standard"),
                "area_m2": questionnaire.get("area_m2", 0.0),
                "wood_type": questionnaire.get("wood_type", ""),
                
                # Additional features from project details
                "client_name": project_details.get("client_name", ""),
                "project_location": project_details.get("project_location", ""),
                "total_area_m2": project_details.get("total_area_m2", 0.0),
                
                # Pricing data (target variable)
                "quoted_price": parsed.get("quoted_price", 0.0),
                "subtotal": project_details.get("subtotal", 0.0),
                "vat": project_details.get("vat", 0.0),
                
                # Line items for detailed analysis
                "num_line_items": len(parsed.get("line_items", [])),
                "avg_item_price": self._calculate_avg_item_price(parsed.get("line_items", [])),
                
                # Email metadata
                "email_date": quote.date_sent,
                "email_subject": quote.subject,
                "attachment_name": quote.attachment_name,
                "confidence": quote.confidence,
                
                # Features from email patterns
                "lead_source": self._extract_lead_source(quote.subject, quote.pdf_text),
                "urgency": self._extract_urgency(quote.subject, quote.pdf_text),
                "complexity": self._estimate_complexity(parsed.get("line_items", [])),
            }
            
            training_data.append(features)
        
        return pd.DataFrame(training_data)
    
    def _calculate_avg_item_price(self, line_items: List[Dict[str, Any]]) -> float:
        """Calculate average item price from line items"""
        if not line_items:
            return 0.0
        
        total_price = sum(item.get("total", 0) for item in line_items)
        return total_price / len(line_items)
    
    def _extract_lead_source(self, subject: str, text: str) -> str:
        """Extract lead source from email subject/content"""
        subject_lower = subject.lower()
        text_lower = text.lower()
        
        if any(word in subject_lower for word in ["referral", "recommendation"]):
            return "referral"
        elif any(word in subject_lower for word in ["website", "online", "web"]):
            return "website"
        elif any(word in text_lower for word in ["saw your", "found you", "google"]):
            return "search"
        else:
            return "direct"
    
    def _extract_urgency(self, subject: str, text: str) -> str:
        """Extract urgency level from email content"""
        urgent_keywords = ["urgent", "asap", "rush", "immediate", "emergency"]
        normal_keywords = ["when possible", "no rush", "standard"]
        
        subject_lower = subject.lower()
        text_lower = text.lower()
        
        if any(word in subject_lower or word in text_lower for word in urgent_keywords):
            return "high"
        elif any(word in subject_lower or word in text_lower for word in normal_keywords):
            return "low"
        else:
            return "medium"
    
    def _estimate_complexity(self, line_items: List[Dict[str, Any]]) -> str:
        """Estimate project complexity from line items"""
        if not line_items:
            return "unknown"
        
        num_items = len(line_items)
        has_custom_work = any("custom" in item.get("description", "").lower() for item in line_items)
        
        if num_items >= 10 or has_custom_work:
            return "high"
        elif num_items >= 5:
            return "medium"
        else:
            return "low"
    
    def save_training_data(self, df: pd.DataFrame) -> int:
        """Save training data to database using optimized connection pool"""
        try:
            # Prepare all SQL operations as a batch
            create_table_sql = """
                CREATE TABLE IF NOT EXISTS ml_training_data (
                    id SERIAL PRIMARY KEY,
                    tenant_id VARCHAR(255),
                    project_type VARCHAR(100),
                    materials_grade VARCHAR(50),
                    area_m2 DECIMAL(10,2),
                    wood_type VARCHAR(100),
                    quoted_price DECIMAL(12,2),
                    num_line_items INTEGER,
                    avg_item_price DECIMAL(10,2),
                    lead_source VARCHAR(50),
                    urgency VARCHAR(20),
                    complexity VARCHAR(20),
                    email_date TIMESTAMP,
                    email_subject TEXT,
                    attachment_name VARCHAR(255),
                    confidence DECIMAL(3,2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            
            # Execute table creation
            self.db_manager.execute_query(create_table_sql)
            
            # Prepare batch insert data
            insert_sql = """
                INSERT INTO ml_training_data (
                    tenant_id, project_type, materials_grade, area_m2, wood_type,
                    quoted_price, num_line_items, avg_item_price, lead_source,
                    urgency, complexity, email_date, email_subject, 
                    attachment_name, confidence
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            # Prepare batch data
            batch_data = []
            for _, row in df.iterrows():
                batch_data.append((
                    self.tenant_id, row.get('project_type'), row.get('materials_grade'),
                    row.get('area_m2'), row.get('wood_type'), row.get('quoted_price'),
                    row.get('num_line_items'), row.get('avg_item_price'), 
                    row.get('lead_source'), row.get('urgency'), row.get('complexity'),
                    row.get('email_date'), row.get('email_subject'), 
                    row.get('attachment_name'), row.get('confidence')
                ))
            
            # Execute batch insert
            result = self.db_manager.execute_batch(insert_sql, batch_data)
            
            logger.info(f"Saved {len(batch_data)} training records to database")
            return len(batch_data)
            
        except Exception as e:
            logger.error(f"Error saving training data: {e}")
            return 0
    
    def trigger_ml_training(self):
        """Trigger ML model retraining with new data"""
        try:
            # Import and run training
            from train import main as train_main
            logger.info("Starting ML model retraining...")
            train_main()
            logger.info("ML model retraining completed")
        except Exception as e:
            logger.error(f"Error during ML training: {e}")
    
    def run_full_workflow(self, email_provider: str, credentials: Dict[str, Any], days_back: int = 30) -> Dict[str, Any]:
        """Run the complete email-to-ML training workflow"""
        results = {
            "start_time": datetime.now(),
            "quotes_found": 0,
            "training_records_saved": 0,
            "ml_training_completed": False,
            "errors": []
        }
        
        try:
            # Setup email service
            self.setup_email_service(email_provider, credentials)
            
            # Find client quotes
            quotes = self.find_client_quotes(days_back)
            results["quotes_found"] = len(quotes)
            
            if quotes:
                # Map to training features
                training_df = self.map_to_questionnaire_features(quotes)
                
                # Save to database
                saved_count = self.save_training_data(training_df)
                results["training_records_saved"] = saved_count
                
                # Trigger ML retraining if we have enough new data
                if saved_count >= 5:  # Minimum threshold for retraining
                    self.trigger_ml_training()
                    results["ml_training_completed"] = True
            
        except Exception as e:
            error_msg = f"Workflow error: {e}"
            logger.error(error_msg)
            results["errors"].append(error_msg)
        
        results["end_time"] = datetime.now()
        results["duration"] = results["end_time"] - results["start_time"]
        
        return results


class GmailService:
    """Gmail API integration using existing API endpoints"""
    
    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials
        # credentials should contain api_base_url and authorization headers
        # Use environment variable API_SERVICE_URL or fallback to credentials
        import os
        self.api_base = os.getenv('API_SERVICE_URL') or credentials.get('api_base_url', 'https://joinery-ai.onrender.com')
        self.headers = credentials.get('headers', {})
        logger.info("Gmail service initialized with existing API")
    
    def search_emails(self, keywords: List[str], has_attachments: bool, since_date: datetime, sent_only: bool) -> List[Dict[str, Any]]:
        """Search for emails matching criteria using real Gmail API"""
        
        # Check if we have real credentials with refresh token
        if self.credentials.get('refresh_token'):
            return self._search_real_gmail_emails(keywords, has_attachments, since_date, sent_only)
        
        # No demo mode - require real credentials
        raise RuntimeError("Gmail credentials required. No demo mode available.")
    
    def _search_real_gmail_emails(self, keywords: List[str], has_attachments: bool, since_date: datetime, sent_only: bool) -> List[Dict[str, Any]]:
        """Search real Gmail using refresh token for authentication"""
        import requests
        
        try:
            # Get access token using refresh token
            access_token = self._get_access_token()
            
            # Build Gmail search query
            query_parts = []
            if has_attachments:
                query_parts.append("has:attachment")
            if sent_only:
                query_parts.append("in:sent")
            
            # Add keyword search
            if keywords:
                keyword_query = " OR ".join(keywords)
                query_parts.append(f"({keyword_query})")
            
            # Add date filter
            date_str = since_date.strftime("%Y/%m/%d")
            query_parts.append(f"after:{date_str}")
            
            search_query = " ".join(query_parts)
            logger.info(f"Gmail search query: {search_query}")
            
            # Search Gmail using Gmail API
            url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
            headers = {"Authorization": f"Bearer {access_token}"}
            params = {"q": search_query, "maxResults": 50}
            
            response = requests.get(url, headers=headers, params=params)
            if not response.ok:
                logger.error(f"Gmail search failed: {response.status_code} {response.text}")
                return []
            
            data = response.json()
            message_ids = [msg["id"] for msg in data.get("messages", [])]
            logger.info(f"Found {len(message_ids)} messages matching search")
            
            # Get detailed message data for each message
            emails = []
            for msg_id in message_ids[:10]:  # Limit to first 10 for processing
                email_data = self._get_email_details(access_token, msg_id)
                if email_data:
                    emails.append(email_data)
            
            return emails
            
        except Exception as e:
            logger.error(f"Error searching Gmail: {e}")
            return []
    
    def _get_access_token(self) -> str:
        """Get access token using refresh token"""
        import requests
        
        # Use same OAuth flow as API service
        data = {
            'client_id': os.getenv('GMAIL_CLIENT_ID'),
            'client_secret': os.getenv('GMAIL_CLIENT_SECRET'), 
            'grant_type': 'refresh_token',
            'refresh_token': self.credentials['refresh_token']
        }
        
        response = requests.post('https://oauth2.googleapis.com/token', data=data)
        if not response.ok:
            raise Exception(f"Failed to refresh access token: {response.text}")
            
        return response.json()['access_token']
    
    def _get_email_details(self, access_token: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed email data including attachments"""
        import requests
        
        try:
            url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            response = requests.get(url, headers=headers)
            if not response.ok:
                return None
                
            data = response.json()
            
            # Extract email metadata
            headers_data = {h["name"]: h["value"] for h in data["payload"].get("headers", [])}
            
            # Extract attachments
            attachments = []
            self._extract_attachments(data["payload"], attachments)
            
            return {
                "message_id": message_id,
                "subject": headers_data.get("Subject", ""),
                "sender": headers_data.get("From", ""),
                "recipient": headers_data.get("To", ""),
                "date_sent": headers_data.get("Date", ""),
                "attachments": attachments
            }
            
        except Exception as e:
            logger.error(f"Error getting email details for {message_id}: {e}")
            return None
    
    def _extract_attachments(self, payload: Dict, attachments: List[Dict]):
        """Recursively extract attachments from email payload"""
        if "parts" in payload:
            for part in payload["parts"]:
                self._extract_attachments(part, attachments)
        elif payload.get("filename") and payload.get("body", {}).get("attachmentId"):
            attachments.append({
                "attachment_id": payload["body"]["attachmentId"],
                "filename": payload["filename"],
                "size": payload["body"].get("size", 0)
            })

    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download email attachment using real Gmail API"""
        import requests
        
        try:
            # Get access token using refresh token
            access_token = self._get_access_token()
            
            # Download attachment using Gmail API
            url = f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment_id}"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            response = requests.get(url, headers=headers)
            if not response.ok:
                logger.error(f"Failed to download attachment: {response.status_code}")
                return b""
                
            data = response.json()
            attachment_data = data.get("data", "")
            
            # Decode base64url data
            import base64
            # Gmail uses base64url encoding (- and _ instead of + and /)
            attachment_data = attachment_data.replace('-', '+').replace('_', '/')
            # Add padding if needed
            while len(attachment_data) % 4:
                attachment_data += '='
                
            return base64.b64decode(attachment_data)
                
        except Exception as e:
            logger.error(f"Error downloading attachment: {e}")
            return b""        # Build Gmail search query
        query_parts = []
        
        # Add keywords search - make it more flexible
        if keywords:
            # Try broader search terms
            broader_keywords = keywords + ["attachment", "file", "document"]
            keyword_query = " OR ".join(broader_keywords)
            query_parts.append(f"({keyword_query})")
        
        # Add attachment filter  
        if has_attachments:
            query_parts.append("has:attachment")
        
        # Add date filter - use days_back from function parameter
        days_back = (datetime.now() - since_date).days
        if days_back <= 1:
            query_parts.append("newer_than:1d")
        elif days_back <= 7:
            query_parts.append("newer_than:7d") 
        elif days_back <= 30:
            query_parts.append("newer_than:30d")
        # For larger ranges, don't add date filter to get any results
        
        # Add sent filter (look in sent items for client quotes we sent)
        if sent_only:
            query_parts.append("in:sent")
        
        gmail_query = " ".join(query_parts)
        logger.info(f"Searching Gmail with query: {gmail_query} (days_back: {days_back})")
        
        try:
            # Use existing Gmail import API with custom query
            import requests
            response = requests.post(
                f"{self.api_base}/gmail/import",
                headers=self.headers,
                json={
                    "q": gmail_query,
                    "max": 50  # Search more messages for quotes
                },
                timeout=30
            )
            
            logger.info(f"Gmail API response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"Gmail API returned {response.status_code}: {response.text}")
                raise RuntimeError(f"Failed to search Gmail: {response.status_code} - {response.text}")
            
            data = response.json()
            imported = data.get('imported', [])
            logger.info(f"Gmail API returned {len(imported)} emails")
            
            # Log first few email subjects for debugging
            for i, email in enumerate(imported[:3]):
                subject = email.get('subject', 'No subject')
                logger.info(f"Email {i+1}: {subject}")
            
            # Convert to our expected format
            emails = []
            for item in imported:
                if item.get('createdIngest') and item.get('messageInfo'):
                    msg = item['messageInfo']
                    attachments = []
                    
                    # Check if message has PDF attachments
                    for att in msg.get('attachments', []):
                        if att.get('filename', '').lower().endswith('.pdf'):
                            attachments.append({
                                'attachment_id': att.get('attachmentId'),
                                'filename': att.get('filename'),
                                'size': att.get('size', 0)
                            })
                    
                    if attachments:  # Only include emails with PDF attachments
                        emails.append({
                            'message_id': msg.get('messageId'),
                            'subject': msg.get('subject', ''),
                            'sender': msg.get('from', ''),
                            'recipient': msg.get('to', ''),
                            'date_sent': msg.get('date'),
                            'attachments': attachments
                        })
            
            logger.info(f"Found {len(emails)} emails with PDF attachments")
            return emails
            
        except Exception as e:
            logger.error(f"Error searching Gmail: {e}")
            return []
    
    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download email attachment using existing Gmail API"""
        
        try:
            # Use existing Gmail attachment API
            import requests
            response = requests.get(
                f"{self.api_base}/gmail/attachment/{message_id}/{attachment_id}",
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"Failed to download attachment: {response.status_code}")
                return b""
                
        except Exception as e:
            logger.error(f"Error downloading attachment: {e}")
            return b""


class M365Service:
    """Microsoft 365 API integration"""
    
    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials
        # TODO: Implement M365 API integration
        logger.info("M365 service initialized")
    
    def search_emails(self, keywords: List[str], has_attachments: bool, since_date: datetime, sent_only: bool) -> List[Dict[str, Any]]:
        """Search for emails matching criteria"""
        # TODO: Implement M365 API search
        logger.info(f"Searching M365 for emails with keywords: {keywords}")
        return []
    
    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download email attachment"""
        # TODO: Implement M365 API attachment download
        return b""


# CLI interface for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Email-to-ML Training Workflow")
    parser.add_argument("--provider", choices=["gmail", "m365"], required=True, help="Email provider")
    parser.add_argument("--tenant-id", required=True, help="Tenant ID")
    parser.add_argument("--days-back", type=int, default=30, help="Days to look back for emails")
    parser.add_argument("--credentials-file", help="Path to credentials JSON file")
    
    args = parser.parse_args()
    
    # Load credentials
    credentials = {}
    if args.credentials_file:
        with open(args.credentials_file, 'r') as f:
            credentials = json.load(f)
    
    # Get database URL
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable not set")
        exit(1)
    
    # Run workflow
    workflow = EmailTrainingWorkflow(db_url, args.tenant_id)
    results = workflow.run_full_workflow(args.provider, credentials, args.days_back)
    
    print(f"Workflow Results:")
    print(f"- Duration: {results['duration']}")
    print(f"- Quotes found: {results['quotes_found']}")
    print(f"- Training records saved: {results['training_records_saved']}")
    print(f"- ML training completed: {results['ml_training_completed']}")
    if results['errors']:
        print(f"- Errors: {results['errors']}")