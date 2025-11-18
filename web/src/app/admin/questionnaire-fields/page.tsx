"use client";
import React from "react";
import AdminQuestionnaireFieldsTable from "@/components/questionnaire/AdminQuestionnaireFieldsTable";

export default function QuestionnaireFieldsAdminPage() {
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <AdminQuestionnaireFieldsTable />
      <p className="text-[11px] text-slate-400">
        Drag rows to reorder. Click label or type to edit inline. Select fields expose a JSON options editor. Changes
        auto-save. Costing Key maps this field to pricing logic. Only label & type are inline editable per spec; other
        edits use controls provided. Deleting is immediate (soft delete if backend implements). Reorder persistence
        uses /questionnaire-fields/reorder.
      </p>
    </div>
  );
}
