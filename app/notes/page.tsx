import { getNotes } from "@/app/actions";
import { NotesBoardWindow } from "@/components/notes-board-window";

export default async function NotesPage() {
  const notes = await getNotes();

  return <NotesBoardWindow initialNotes={notes} />;
}
