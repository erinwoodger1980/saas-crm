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
            "joinery", "windows", "doors", "timber"
        ]
        
        emails = self.email_service.search_emails(
            keywords=quote_keywords,
            has_attachments=True,
            since_date=since_date,
            sent_only=True  # Only emails we sent to clients
        )
        
        client_quotes = []
        
        for email in emails:
            # Check if email has PDF attachments
            for attachment in email.get("attachments", []):
                if attachment.get("filename", "").lower().endswith(".pdf"):
                    try:
                        quote = self._process_email_attachment(email, attachment)
                        if quote and quote.confidence > 0.5:  # Only high-confidence quotes
                            client_quotes.append(quote)
                    except Exception as e:
                        logger.error(f"Error processing attachment {attachment.get('filename')}: {e}")
        
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
                date_sent=email["date_sent"],
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
    """Gmail API integration"""
    
    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials
        # TODO: Implement Gmail API integration
        logger.info("Gmail service initialized")
    
    def search_emails(self, keywords: List[str], has_attachments: bool, since_date: datetime, sent_only: bool) -> List[Dict[str, Any]]:
        """Search for emails matching criteria"""
        # TODO: Implement Gmail API search
        logger.info(f"Searching Gmail for emails with keywords: {keywords}")
        return []
    
    def download_attachment(self, message_id: str, attachment_id: str) -> bytes:
        """Download email attachment"""
        # TODO: Implement Gmail API attachment download
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