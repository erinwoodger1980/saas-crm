"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Plus, Calendar, FileText, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CoachingNote {
  id: string;
  sessionDate: string;
  notes: string;
  commitments: string[];
  createdAt: string;
}

export default function CoachingNotesPage() {
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [noteText, setNoteText] = useState("");
  const [commitments, setCommitments] = useState<string[]>([""]);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const data = await apiFetch<{ notes: CoachingNote[] }>("/coaching/notes");
      setNotes(data.notes || []);
    } catch (error) {
      console.error("Failed to load coaching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!noteText.trim()) return;

    const validCommitments = commitments.filter((c) => c.trim());
    
    try {
      setLoading(true);
      await apiFetch("/coaching/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          notes: noteText,
          commitments: validCommitments,
        }),
      });
      
      setShowCreateDialog(false);
      setNoteText("");
      setCommitments([""]);
      setSessionDate(new Date().toISOString().split("T")[0]);
      await loadNotes();
    } catch (error) {
      console.error("Failed to create note:", error);
      alert("Failed to create coaching note");
    } finally {
      setLoading(false);
    }
  };

  const addCommitmentField = () => {
    setCommitments([...commitments, ""]);
  };

  const updateCommitment = (index: number, value: string) => {
    const updated = [...commitments];
    updated[index] = value;
    setCommitments(updated);
  };

  const removeCommitment = (index: number) => {
    setCommitments(commitments.filter((_, i) => i !== index));
  };

  if (loading && notes.length === 0) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Coaching Notes</h1>
          <p className="mt-2 text-sm text-slate-600">
            Record session notes and track commitments
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Sessions Yet</CardTitle>
            <CardDescription>Start recording your coaching sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes
            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
            .map((note) => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {new Date(note.sessionDate).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </CardTitle>
                        <CardDescription>
                          Added {new Date(note.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    {note.commitments.length > 0 && (
                      <Badge variant="outline">
                        {note.commitments.length} commitment{note.commitments.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-900">Session Notes</h4>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{note.notes}</p>
                  </div>
                  
                  {note.commitments.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-900">Commitments</h4>
                      <div className="space-y-2">
                        {note.commitments.map((commitment, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <p className="flex-1 text-sm text-slate-700">{commitment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Coaching Session</DialogTitle>
            <DialogDescription>Record notes and commitments from your session</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="sessionDate">Session Date</Label>
              <Input
                id="sessionDate"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Session Notes</Label>
              <Textarea
                id="notes"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What did you discuss? Key insights, challenges, progress..."
                rows={8}
                className="resize-none"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Commitments</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addCommitmentField}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {commitments.map((commitment, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={commitment}
                      onChange={(e) => updateCommitment(idx, e.target.value)}
                      placeholder={`Commitment ${idx + 1}`}
                    />
                    {commitments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCommitment(idx)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={!noteText.trim()}>
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
