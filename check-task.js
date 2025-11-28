// Quick script to check a task's structure
// Usage: node check-task.js <taskId>

const taskId = process.argv[2];
if (!taskId) {
  console.log('Usage: node check-task.js <taskId>');
  process.exit(1);
}

async function checkTask() {
  const { PrismaClient } = await import('./api/node_modules/.prisma/client/index.js');
  const prisma = new PrismaClient();

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: true,
      }
    });

    if (!task) {
      console.log('Task not found');
      return;
    }

    console.log('\n=== TASK DETAILS ===');
    console.log('ID:', task.id);
    console.log('Title:', task.title);
    console.log('Task Type:', task.taskType);
    console.log('Status:', task.status);
    console.log('Related Type:', task.relatedType);
    console.log('Related ID:', task.relatedId);
    
    console.log('\n=== FORM SCHEMA ===');
    if (task.formSchema) {
      console.log('Has formSchema:', true);
      console.log('formSchema:', JSON.stringify(task.formSchema, null, 2));
      if (task.formSchema.fields) {
        console.log('Number of fields:', task.formSchema.fields.length);
      } else {
        console.log('⚠️  formSchema exists but has NO fields property');
      }
    } else {
      console.log('Has formSchema:', false);
      console.log('⚠️  No formSchema on this task');
    }

    console.log('\n=== CHECKLIST ITEMS ===');
    if (task.checklistItems) {
      console.log('Has checklistItems:', true);
      console.log('Number of items:', task.checklistItems.length);
    } else {
      console.log('Has checklistItems:', false);
    }

    console.log('\n=== META ===');
    if (task.meta) {
      console.log('Meta:', JSON.stringify(task.meta, null, 2));
    } else {
      console.log('No meta');
    }

    console.log('\n=== RECOMMENDATIONS ===');
    if (task.taskType !== 'FORM' && task.formSchema) {
      console.log('⚠️  Task has formSchema but taskType is', task.taskType, '- change to FORM');
    }
    if (task.taskType === 'FORM' && !task.formSchema) {
      console.log('⚠️  Task is FORM type but has no formSchema');
    }
    if (task.taskType === 'FORM' && task.formSchema && (!task.formSchema.fields || task.formSchema.fields.length === 0)) {
      console.log('⚠️  Task is FORM type but formSchema.fields is empty');
    }

  } finally {
    await prisma.$disconnect();
  }
}

checkTask().catch(console.error);
