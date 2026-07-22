import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

function normalizeProjectName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export default function ProjectField({
  value = '',
  projects = [],
  inputId = 'project-field',
  className = '',
  onChange,
  onCreateProject,
  onFocus,
  onKeyDown,
}) {
  const safeValue = typeof value === 'string' ? value : '';
  const datalistId = `${inputId}-options`;
  const normalizedValue = normalizeProjectName(safeValue);
  const projectOptions = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(projects) ? projects : [])
      .map(normalizeProjectName)
      .filter((projectName) => {
        if (!projectName) return false;
        const key = projectName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [projects]);
  const projectExists = projectOptions.some(
    (projectName) => projectName.toLowerCase() === normalizedValue.toLowerCase(),
  );
  const canCreateProject = Boolean(normalizedValue) && !projectExists;

  const handleCreateProject = () => {
    if (!canCreateProject) return;
    onCreateProject?.(normalizedValue);
  };

  return (
    <div className={`project-field electron-no-drag${className ? ` ${className}` : ''}`}>
      <label className="project-field__label" htmlFor={inputId}>
        Project <span className="project-field__optional">Optional</span>
      </label>
      <div className="project-field__control">
        <input
          id={inputId}
          className="project-field__input"
          value={safeValue}
          list={datalistId}
          maxLength={64}
          onFocus={onFocus}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (event.key !== 'Enter' || !canCreateProject) return;
            event.preventDefault();
            handleCreateProject();
          }}
          placeholder="Choose or type"
          aria-label="Project optional"
        />
        <datalist id={datalistId}>
          {projectOptions.map((projectName) => (
            <option key={projectName} value={projectName} />
          ))}
        </datalist>
        {canCreateProject ? (
          <Button
            type="button"
            variant="outline"
            className="project-field__create-btn"
            onClick={handleCreateProject}
          >
            <Plus size={12} />
            Create project
          </Button>
        ) : null}
      </div>
    </div>
  );
}
