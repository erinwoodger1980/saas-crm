/**
 * Example Door Configurator Page
 * Demonstrates usage of the professional door configurator
 */

'use client';

import { DoorConfigurator } from '@/components/configurator/DoorConfigurator';
import { createStandardDoorScene } from '@/lib/scene-utils';
import { SceneConfig } from '@/types/scene-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConfiguratorDemoPage() {
  // Create initial configuration
  const initialConfig = createStandardDoorScene(914, 2032, 45);

  const handleConfigChange = (config: SceneConfig) => {
    console.log('Configuration updated:', config);
    // You can sync this to other parts of your app
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Professional Door Configurator</h1>
        <p className="text-muted-foreground">
          Full state persistence with FileMaker parity. Camera position, visibility, and view mode all persist exactly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main configurator */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>3D Door Configurator</CardTitle>
              <CardDescription>
                Interactive 3D view with persistent camera state and component visibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DoorConfigurator
                tenantId="demo-tenant"
                entityType="door"
                entityId="demo-door-001"
                initialConfig={initialConfig}
                onChange={handleConfigChange}
                height="600px"
              />
            </CardContent>
          </Card>
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">State Persistence</h4>
                <p className="text-muted-foreground">
                  Camera position, rotation, zoom, and view mode persist to database
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Component Visibility</h4>
                <p className="text-muted-foreground">
                  Toggle individual components on/off with hierarchical tree
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Camera Modes</h4>
                <p className="text-muted-foreground">
                  Switch between Perspective and Orthographic views
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Dynamic Lighting</h4>
                <p className="text-muted-foreground">
                  Lights scale automatically based on product extents
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rotate</span>
                <span className="font-medium">Left Click + Drag</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pan</span>
                <span className="font-medium">Right Click + Drag</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zoom</span>
                <span className="font-medium">Mouse Wheel</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Technical Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Framework:</span>
                <span className="ml-2 font-medium">React + Next.js</span>
              </div>
              <div>
                <span className="text-muted-foreground">3D Engine:</span>
                <span className="ml-2 font-medium">Three.js + R3F</span>
              </div>
              <div>
                <span className="text-muted-foreground">Database:</span>
                <span className="ml-2 font-medium">PostgreSQL + Prisma</span>
              </div>
              <div>
                <span className="text-muted-foreground">State:</span>
                <span className="ml-2 font-medium">JSON in database</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
