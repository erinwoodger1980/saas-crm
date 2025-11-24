# Fire Door Quote Builder - Column Expansion Plan

## Current Columns (16)
1. # (row number)
2. Door Ref
3. Location  
4. Qty
5. Fire Rating
6. Door Set Type
7. Handing
8. Height (mm)
9. Width (mm)
10. Thickness
11. Internal Colour
12. External Colour
13. Ironmongery Pack
14. Unit Price (£)
15. Line Total (£)
16. Actions

## Additional Columns from CSV/Schema (40+)

### Core Fields
- Item Type (itemType)
- Code (code)
- Acoustic Rating dB (acousticRatingDb)

### Leaf Configuration
- Leaf Configuration (leafConfiguration)
- Slave Leaf Width (slaveLeafWidth)
- If Split, Master Leaf Size (ifSplitMasterSize)

### Finishes & Edges
- Door Finish - Side 1/Push (doorFinishSide1)
- Door Finish - Side 2/Pull (doorFinishSide2)
- Door Facing (doorFacing)
- Lipping Finish (lippingFinish)
- Frame Finish (frameFinish)
- Door Edge Protection Type (doorEdgeProtType)
- Door Edge Protection Position (doorEdgeProtPos)
- Door Undercut (doorUndercut)
- Door Undercut (mm) (doorUndercutMm)

### Vision Panels - Leaf 1
- Vision Panel Qty, Leaf 1 (visionQtyLeaf1)
- Leaf 1 Aperture 1 Width (vp1WidthLeaf1)
- Leaf 1 Aperture 1 Height (vp1HeightLeaf1)
- Leaf 1 Aperture 2 Width (vp2WidthLeaf1)
- Leaf 1 Aperture 2 Height (vp2HeightLeaf1)

### Vision Panels - Leaf 2
- Vision Panel Qty, Leaf 2 (visionQtyLeaf2)
- Leaf 2 Cut Out Aperture 1 Width (vp1WidthLeaf2)
- Leaf 2 Cut Out Aperture 1 Height (vp1HeightLeaf2)
- Leaf 2 Cut Out Aperture 2 Width (vp2WidthLeaf2)
- Leaf 2 Cut Out Aperture 2 Height (vp2HeightLeaf2)

### Glazing
- Total Glazed Area Master Leaf (msq) (totalGlazedAreaMaster)
- Fanlight/Sidelight Glazing (fanlightSidelightGlz)
- Glazing Tape (glazingTape)

### Ironmongery & Accessories
- Closers / Floor Springs (closerOrFloorSpring)
- Spindle Face Prep (spindleFacePrep)
- Cylinder Face Prep (cylinderFacePrep)
- Flush Bolt Supply/Prep (flushBoltSupplyPrep)
- Flush Bolt Qty (flushBoltQty)
- Finger Protection (fingerProtection)
- Fire Signage (fireSignage)
- Fire Signage Qty (fireSignageQty)
- Factory Fit Fire Signage (fireSignageFactoryFit)
- Fire ID Disc (fireIdDisc)
- Fire ID Disc Qty (fireIdDiscQty)
- Door Viewer (doorViewer)
- Door Viewer Position (doorViewerPosition)
- Door Viewer Prep Size (doorViewerPrepSize)
- Door Chain (doorChain)
- Door Viewers Qty (doorViewersQty)
- Factory Fit Door Chain (doorChainFactoryFit)
- Factory Fit Door Viewers (doorViewersFactoryFit)

### Additional Notes
- Addition 1 / Note 1 (additionNote1)
- Addition 1 Qty (additionNote1Qty)

### Costing
- Labour Cost (labourCost)
- Material Cost (materialCost)

## Implementation Strategy

### Phase 1: Critical Specifications (Priority High)
Add these columns immediately as they're essential for quoting:
1. Acoustic Rating dB
2. Leaf Configuration
3. Slave Leaf Width
4. Door Finish Side 1 & 2
5. Door Facing
6. Frame Finish
7. Lipping Finish

### Phase 2: Vision Panels & Glazing
8. Vision Panel quantities and dimensions (both leaves)
9. Glazing specifications

### Phase 3: Extended Ironmongery
10. Closer/Floor Spring details
11. Hardware preparation specs
12. Fire safety accessories
13. Door viewers and chains

### Phase 4: Notes & Costing
14. Addition notes
15. Labour and material costs breakdown

## UI Considerations

- **Horizontal scrolling**: With 50+ columns, implement smooth horizontal scroll
- **Column grouping**: Visual separators between logical groups (Core, Dimensions, Finishes, Vision Panels, Ironmongery)
- **Expandable sections**: Consider collapsible column groups to reduce initial width
- **Sticky columns**: Keep #, Door Ref, Location, and Actions sticky on left/right
- **Filter/hide columns**: Allow users to show/hide column groups
- **Bulk edit**: Add ability to copy values down a column for repeated specs
