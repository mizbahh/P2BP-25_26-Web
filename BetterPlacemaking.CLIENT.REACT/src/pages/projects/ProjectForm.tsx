import { useState, type FormEvent } from "react";
import { Button, InputText, Panel, type DynamicDialogComponentProps } from "../../components/prime";
import type { ProjectDto } from "../../lib/projectTypes";

/** Opened through useDialogService().open(ProjectForm, { data: project }) - mirrors the Angular DynamicDialog form. */
export function ProjectForm({ data, dialogRef }: DynamicDialogComponentProps<ProjectDto | undefined, ProjectDto>) {
  const existing = data;
  const [title, setTitle] = useState(existing?.Title ?? "");
  const [description, setDescription] = useState(existing?.Description ?? "");
  const [location, setLocation] = useState(existing?.Location ?? "");
  const invalid = title === "";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    dialogRef.close({
      ...existing,
      Id: existing?.Id ?? "",
      Title: title,
      Description: description,
      Location: location,
    } as ProjectDto);
  }

  return (
    <form onSubmit={onSubmit} className="p-fluid flex flex-col gap-4 p-4">
      <Panel header="Project Details">
        <div className="grid gap-4 md:grid-cols-2">
          {existing?.Id ? (
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="project-id" className="font-semibold">Id</label>
              <InputText id="project-id" disabled value={existing.Id} readOnly />
            </div>
          ) : null}

          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="project-title" className="font-semibold">Title</label>
            <InputText id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="project-description" className="font-semibold">Description</label>
            <InputText id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="project-location" className="font-semibold">Location</label>
            <InputText id="project-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
      </Panel>

      <div className="flex justify-end gap-2">
        <Button type="button" label="Cancel" className="p-button-text" onClick={() => dialogRef.close()} />
        <Button type="submit" label="Save" disabled={invalid} />
      </div>
    </form>
  );
}
