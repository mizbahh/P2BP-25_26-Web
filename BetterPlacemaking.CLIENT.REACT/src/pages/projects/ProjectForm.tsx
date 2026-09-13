import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";
import type { ProjectDto } from "../../lib/projectTypes";
import type { ProjectInput } from "../../services/projectApi";

interface ProjectFormProps {
  project?: ProjectDto;
  onSave: (input: ProjectInput) => void;
  onClose: () => void;
}

export function ProjectForm({ project, onSave, onClose }: ProjectFormProps) {
  const [title, setTitle] = useState(project?.Title ?? "");
  const [description, setDescription] = useState(project?.Description ?? "");
  const [location, setLocation] = useState(project?.Location ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({ Title: title, Description: description, Location: location });
  }

  return (
    <Modal title={project ? "Edit Project" : "Add Project"} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {project?.Id && (
          <label className="block text-sm font-medium text-neutral-700">
            Id
            <input
              disabled
              value={project.Id}
              className="mt-1 w-full rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500"
            />
          </label>
        )}
        <label className="block text-sm font-medium text-neutral-700">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
