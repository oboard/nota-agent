import { notFound } from "next/navigation";
import { getNote } from "@/app/actions";
import { NoteWindow } from "@/components/note-window";

interface NotePageProps {
  params: Promise<{ id: string }>;
}

export default async function NotePage({ params }: NotePageProps) {
  const { id } = await params;
  const note = await getNote(id);

  if (!note) {
    notFound();
  }

  return <NoteWindow initialNote={note} />;
}
