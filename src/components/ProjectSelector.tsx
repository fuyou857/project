import { useState, useCallback, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { supabase } from '../supabase/client';
import { useClickOutside } from '../hooks/useClickOutside';

export interface Project {
  id: string;
  name: string;
  project_code?: string;
  project_manager?: string;
}

export type ProjectSearchMode = 'keyword' | 'code' | 'manager';

interface ProjectSelectorProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export default function ProjectSelector({
  value,
  onChange,
  label = '关联项目',
  placeholder = '搜索项目...',
  required = false,
}: ProjectSelectorProps) {
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchMode, setSearchMode] = useState<ProjectSearchMode>('keyword');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_code, project_manager')
        .order('name');
      if (error) throw error;
      setProjects((data ?? []) as Project[]);
      setFilteredProjects((data ?? []).slice(0, 10) as Project[]);
    } catch (err) {
      console.error('加载项目失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setFilteredProjects(projects.slice(0, 10));
      return;
    }

    const filtered = projects.filter((p) => {
      switch (searchMode) {
        case 'keyword':
          return (
            p.name.toLowerCase().includes(q) ||
            (p.project_code?.toLowerCase().includes(q) ?? false) ||
            (p.project_manager?.toLowerCase().includes(q) ?? false)
          );
        case 'code':
          return p.project_code?.toLowerCase().includes(q) ?? false;
        case 'manager':
          return p.project_manager?.toLowerCase().includes(q) ?? false;
        default:
          return false;
      }
    });
    setFilteredProjects(filtered);
  }, [search, searchMode, projects]);

  useEffect(() => {
    const selected = projects.find((p) => p.id === value);
    if (selected) {
      setSearch(selected.name);
    }
  }, [value, projects]);

  useClickOutside(dropdownRef, () => setShowDropdown(false));

  const getDisplayText = (project: Project) => {
    const parts = [project.name];
    if (project.project_code) parts.push(`[${project.project_code}]`);
    if (project.project_manager) parts.push(`- ${project.project_manager}`);
    return parts.join(' ');
  };

  return (
    <div>
      {label && (
        <label className="block text-sm text-gray-600 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-1 mb-1">
          <button
            type="button"
            onClick={() => setSearchMode('keyword')}
            className={`px-2 py-0.5 text-xs rounded ${
              searchMode === 'keyword'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            关键词
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('code')}
            className={`px-2 py-0.5 text-xs rounded ${
              searchMode === 'code'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            项目编号
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('manager')}
            className={`px-2 py-0.5 text-xs rounded ${
              searchMode === 'manager'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            项目负责人
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={placeholder}
          />
          <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-64 overflow-y-auto shadow-lg">
            {loading ? (
              <div className="p-3 text-gray-500 text-sm">加载中...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-3 text-gray-500 text-sm">
                {projects.length === 0 ? '暂无项目' : '未找到匹配的项目'}
              </div>
            ) : (
              <>
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      onChange(project.id);
                      setSearch(getDisplayText(project));
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      value === project.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{project.name}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      {project.project_code && <span>编号: {project.project_code}</span>}
                      {project.project_manager && <span>负责人: {project.project_manager}</span>}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
