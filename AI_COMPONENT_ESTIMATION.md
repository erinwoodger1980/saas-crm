# AI Component Estimation for Product Templates

## Overview

Product templates in Settings → Product Types can now use AI to automatically estimate component structures from images or descriptions. OpenAI Vision analyzes your input and suggests components with sizes, profiles, and positions, which you can then refine and save as defaults.

## Features

### 1. AI-Powered Component Detection
- **Image Analysis**: Upload a photo of a door/window and AI detects:
  - Stiles, rails, mullions, transoms
  - Glass panels and glazing bars
  - Component dimensions and positions
  - Suggested profile sizes
  
- **Description-Based**: Provide a text description:
  - "Six panel traditional door with raised panels"
  - "Double hung sash window with 2x2 muntins"
  - "French doors with divided lights"

### 2. Workflow Integration
1. **Start AI Estimation**
   - Click "AI Estimate" button on any product option
   - Upload image OR enter description (or both for best results)
   - AI analyzes and generates component structure

2. **Review & Refine**
   - AI estimates open directly in 3D configurator
   - See components rendered in 3D
   - Edit positions, sizes, materials
   - Add/remove components as needed

3. **Save as Template**
   - Auto-saves refined configuration
   - Becomes default for this product type
   - Used when creating quotes

## Usage Guide

### Quick Start

1. **Navigate to Settings → Product Types**
2. **Expand a product option**
3. **Click "AI Estimate"** (purple gradient button with sparkles ✨)

### Image-Based Estimation

**Best Practices:**
- Use clear, well-lit photos
- Front elevation view works best
- Include full door/window in frame
- Avoid perspective distortion

**Supported Image Types:**
- JPG, PNG, WebP
- Max 10MB file size
- High resolution recommended

**Example workflow:**
```
1. Upload photo of 6-panel door
2. AI detects:
   - 2 vertical stiles (100mm wide)
   - 3 horizontal rails (70mm high)
   - 6 raised panels
   - Component positions calculated
3. Confidence: 92%
4. Opens in configurator for refinement
```

### Description-Based Estimation

**Effective Descriptions:**
- Specify component count: "4 panel", "2x3 muntin grid"
- Mention materials: "solid timber", "glass panels"
- Include dimensions if known: "top rail 200mm"
- Describe style: "traditional raised", "contemporary flat"

**Examples:**
```
"Traditional 6-panel door with raised panels, 
stiles 100mm wide, top and bottom rails 200mm"

"Casement window with 2x2 muntin grid, 
timber frame, glass panes"

"French doors, 15 lites per door, 
small pox glazing bars"
```

### Hybrid Approach (Best Results)

Upload image **AND** provide description:
- AI uses visual analysis for layout
- Description provides context for materials/style
- Higher confidence scores
- More accurate component sizing

## AI Estimation Details

### Component Types Detected

- **Stiles**: Vertical outer frame members
- **Rails**: Horizontal outer frame members
- **Mullions**: Vertical intermediate dividers
- **Transoms**: Horizontal intermediate dividers
- **Panels**: Solid infill components
- **Glass**: Glazed areas
- **Glazing Bars**: Narrow decorative dividers

### Confidence Scoring

- **90-100%**: High confidence, minimal editing needed
- **75-89%**: Good estimate, minor adjustments likely
- **60-74%**: Reasonable starting point, review carefully
- **<60%**: Use as rough guide, significant refinement needed

### Position Coordinates

AI estimates use standard 3D coordinate system:
- **Origin (0,0,0)**: Center of product
- **X-axis**: Left (-) to Right (+)
- **Y-axis**: Bottom (-) to Top (+)
- **Z-axis**: Back (-) to Front (+)

All measurements in millimeters.

## Technical Implementation

### API Endpoint

**POST /ai/estimate-components**

Request (multipart/form-data):
```json
{
  "data": {
    "productType": {
      "category": "doors",
      "type": "entrance",
      "option": "entrance-single"
    },
    "dimensions": {
      "widthMm": 914,
      "heightMm": 2032,
      "depthMm": 45
    },
    "description": "Six panel door with raised panels"
  },
  "image": File (optional)
}
```

Response:
```json
{
  "components": [
    {
      "id": "stile-left",
      "type": "stile",
      "label": "Left Stile",
      "geometry": { "width": 100, "height": 2032, "depth": 45 },
      "position": { "x": -407, "y": 0, "z": 0 },
      "material": "timber",
      "profile": {
        "suggested": "Traditional stile profile",
        "widthMm": 100,
        "depthMm": 45
      },
      "confidence": 0.92
    }
  ],
  "reasoning": "Detected traditional 6-panel layout with...",
  "confidence": 0.89,
  "suggestions": [
    "Consider increasing stile width to 110mm for better proportions"
  ]
}
```

### OpenAI Integration

- **Model**: GPT-4 Vision (gpt-4o)
- **Temperature**: 0.3 (consistent results)
- **Response Format**: JSON object
- **Max Tokens**: 2000

### Scene Config Conversion

AI components are automatically converted to SceneConfig format:
- Components mapped to 3D geometry
- Materials assigned based on type
- Positions calculated from product center
- Profiles generated for each component type

## Use Cases

### Standard Product Templates

Create library of common configurations:
- Traditional 6-panel door
- Georgian window with glazing bars
- Contemporary flush door
- Bay window with mullions

### Custom Product Estimation

Quick estimation for unusual requests:
- Upload customer photo
- AI generates starting point
- Refine to exact specifications
- Save as new product option

### Training Data

AI improves with usage:
- Refined configurations become examples
- Pattern recognition improves
- Profile suggestions get more accurate
- Material detection enhanced

## Limitations

### Current Constraints

1. **2D Input Only**: No 3D/LiDAR support yet
2. **Standard Layouts**: Works best with conventional designs
3. **Curved Components**: Limited support for arches/curves
4. **Hardware**: Doesn't detect hinges, handles, locks
5. **Finishes**: Can't determine paint/stain colors

### When to Use Manual Building

- Complex custom curved designs
- Non-standard component arrangements
- Precise hardware positioning required
- Exotic materials or finishes

## Future Enhancements

Planned improvements:
- [ ] 3D point cloud support (LiDAR)
- [ ] Multi-image analysis (multiple angles)
- [ ] Hardware detection and placement
- [ ] Material/finish recognition
- [ ] Style classification (Georgian, Victorian, etc.)
- [ ] Dimension extraction from images
- [ ] Automatic material database lookup
- [ ] Learning from user corrections

## Tips for Best Results

1. **Combine Image + Description**: Most accurate
2. **Specify Dimensions**: Include in description if known
3. **Clear Photos**: Good lighting, minimal background
4. **Standard Terminology**: Use joinery terms (stile, rail, etc.)
5. **Review Confidence**: Low confidence = needs refinement
6. **Save Iterations**: Build template library over time

## Examples

### Example 1: Traditional Door
- **Input**: Photo + "6-panel raised door, oak"
- **AI Output**: 2 stiles, 3 rails, 6 panels
- **Confidence**: 94%
- **Edit**: Adjusted panel depth slightly
- **Result**: Perfect template

### Example 2: Georgian Window
- **Input**: Description only: "Double hung sash, 3x4 muntin grid"
- **AI Output**: Frame + 12 panes + glazing bars
- **Confidence**: 87%
- **Edit**: Refined muntin widths
- **Result**: Excellent starting point

### Example 3: Contemporary Flush Door
- **Input**: Photo of minimal design
- **AI Output**: 2 stiles, 2 rails, 1 panel
- **Confidence**: 82%
- **Edit**: Minimal changes needed
- **Result**: Production-ready template
