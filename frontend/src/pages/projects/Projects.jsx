import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Box, Typography,
  Autocomplete, TextField, Chip, Drawer, IconButton, Divider,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import { Plus, X, Upload, FileText, Download, Trash2, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { projectAPI, employeeAPI, documentAPI } from '../../services/services';
import {
  Card, Button, SearchBar, StatusBadge, Loader, EmptyState, Input, ConfirmDialog, DataTable,
} from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage, getFullName, downloadBlob } from '../../utils/helpers';

const TECH_SUGGESTIONS = [
  'React', 'Node.js', 'Express', 'MongoDB', 'MySQL', 'PostgreSQL',
  'Redis', 'Docker', 'AWS', 'TypeScript', 'Next.js', 'Vue', 'Angular',
  'Python', 'Django', 'Java', 'Spring Boot', 'GraphQL', 'Kubernetes',
];

const UPDATE_STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
];

// Adjust these to match your actual `status`/`priority` enum values if different.
const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PROJECT_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const DRAWER_WIDTH = 480;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Backend expects YYYY-MM-DD for startDate/endDate; project.start_date may
// come back as a full ISO/datetime string, so normalize it for the date input.
const toDateInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const DetailRow = ({ label, value }) => (
  <Box display="flex" justifyContent="space-between" py={0.75}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={500} textAlign="right">{value ?? '—'}</Typography>
  </Box>
);

const Projects = () => {
  const { isAdminOnly, isHr } = useAuth();
  const canManageProjects = isAdminOnly || isHr;

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  // Synchronous guard against double-submits (fast repeated clicks fire before
  // React re-renders the disabled button, so state alone isn't reliable here).
  const creatingProjectRef = useRef(false);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  // --- Initial documentation files for Add Project ---
  const [pendingDocs, setPendingDocs] = useState([]);

  // --- Edit Project drawer state (shared between list and detail views) ---
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const savingEditRef = useRef(false);
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    formState: { errors: editErrors },
  } = useForm();

  // --- Delete Project state ---
  const [projectDeleteId, setProjectDeleteId] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // --- Add Update drawer state ---
  const [updateDrawerOpen, setUpdateDrawerOpen] = useState(false);
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const {
    register: registerUpdate,
    handleSubmit: handleSubmitUpdate,
    reset: resetUpdate,
    control: controlUpdate,
    formState: { errors: updateErrors },
  } = useForm({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      workDone: '',
      gitRepo: '',
      websiteUrl: '',
      status: 'in-progress',
    },
  });

  const [pendingUpdateDocs, setPendingUpdateDocs] = useState([]);
  const [projectUpdates, setProjectUpdates] = useState([]);
  const [updatesPagination, setUpdatesPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // --- Project documents ---
  const [projectDocs, setProjectDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docDeleteId, setDocDeleteId] = useState(null);

  const refreshProjectList = () =>
    projectAPI.getAll({ search, limit: 100 })
      .then(({ data }) => setProjects(data.data || []))
      .catch((e) => toast.error(getErrorMessage(e)));

  useEffect(() => {
    setLoading(true);
    refreshProjectList().finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    if (!canManageProjects || !(drawerOpen || editDrawerOpen)) return;
    employeeAPI.getTeamLeads()
      .then(({ data }) => setTeamLeads(data.data || []))
      .catch(() => setTeamLeads([]));
    employeeAPI.getAssignable()
      .then(({ data }) => setEmployees(data.data || []))
      .catch(() => setEmployees([]));
  }, [canManageProjects, drawerOpen, editDrawerOpen]);

  const teamLeadOptions = teamLeads.map((e) => ({
    id: e.id,
    label: `${getFullName(e.first_name, e.last_name)}${e.designation ? ` — ${e.designation}` : ''}`,
  }));

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    label: `${getFullName(e.first_name, e.last_name)}${e.designation ? ` — ${e.designation}` : ''}`,
  }));

  const fetchProjectDocs = async (projectId) => {
    setDocsLoading(true);
    try {
      const { data } = await documentAPI.getAll({ projectId });
      setProjectDocs(data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchProjectUpdates = async (projectId, page = 1, limit = 10) => {
    setUpdatesLoading(true);
    try {
      const { data } = await projectAPI.getUpdates(projectId, { page, limit });
      setProjectUpdates(data.data || []);
      setUpdatesPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUpdatesLoading(false);
    }
  };

  const loadProject = async (id, updatesPage = 1, updatesLimit = 10) => {
    try {
      const { data } = await projectAPI.getById(id, { updatesPage, updatesLimit });
      setSelectedProject(data.data);
      setProjectUpdates(data.data.updates || []);
      setUpdatesPagination(data.data.updatesPagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      setView('detail');
      fetchProjectDocs(id);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const refreshSelectedProject = async () => {
    if (!selectedProject) return;
    try {
      const { data } = await projectAPI.getById(selectedProject.id);
      setSelectedProject(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openAddDrawer = () => {
    reset();
    setPendingDocs([]);
    setDrawerOpen(true);
  };

  const closeAddDrawer = () => {
    setDrawerOpen(false);
  };

  const handlePendingDocSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setPendingDocs((prev) => [...prev, ...files]);
  };

  const removePendingDoc = (index) => {
    setPendingDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData) => {
    if (creatingProjectRef.current) return;
    if (!formData.teamLead) {
      toast.error('Please select a team lead');
      return;
    }
    creatingProjectRef.current = true;
    setCreatingProject(true);
    setSubmitting(true);
    try {
      const memberIds = (formData.employees || [])
        .map((opt) => opt.id)
        .filter((id) => id !== formData.teamLead.id);

      const { data: created } = await projectAPI.create({
        name: formData.name,
        description: formData.description || '',
        startDate: formData.startDate,
        endDate: formData.endDate,
        teamLeadId: formData.teamLead.id,
        memberIds,
        techStack: formData.techStack || [],
      });

      const newProjectId = created?.id;

      // Project creation is the source of truth for success/failure here.
      // Close the drawer and reset the form as soon as it succeeds, so a
      // later document-upload failure can never look like the whole
      // submission failed (which previously led to accidental re-submits
      // and duplicate projects).
      toast.success('Project created successfully');
      closeAddDrawer();
      reset();

      if (newProjectId && pendingDocs.length) {
        let failedUploads = 0;
        for (const file of pendingDocs) {
          const fd = new FormData();
          fd.append('document', file);
          fd.append('projectId', newProjectId);
          fd.append('type', 'other');
          fd.append('title', file.name);
          try {
            await documentAPI.upload(fd);
          } catch {
            failedUploads += 1;
          }
        }
        if (failedUploads) {
          toast.error(`Project created, but ${failedUploads} document(s) failed to upload`);
        }
      }

      setPendingDocs([]);
      await refreshProjectList();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      creatingProjectRef.current = false;
      setSubmitting(false);
      setCreatingProject(false);
    }
  };

  // --- Edit Project handlers ---
  const openEditDrawer = (project) => {
    setEditingProject(project);
    resetEdit({
      name: project.name || '',
      description: project.description || '',
      startDate: toDateInputValue(project.start_date),
      endDate: toDateInputValue(project.end_date),
      status: project.status || 'planning',
      priority: project.priority || 'medium',
      completionPercentage: project.completion_percentage ?? 0,
      teamLead: project.manager_id
        ? { id: project.manager_id, label: project.manager_name || '' }
        : null,
      techStack: project.tech_stack || [],
    });
    setEditDrawerOpen(true);
  };

  const closeEditDrawer = () => {
    setEditDrawerOpen(false);
    setEditingProject(null);
  };

  const onSubmitEdit = async (formData) => {
    if (!editingProject || savingEditRef.current) return;
    if (!formData.teamLead) {
      toast.error('Please select a team lead');
      return;
    }
    savingEditRef.current = true;
    setSavingEdit(true);
    try {
      await projectAPI.update(editingProject.id, {
        name: formData.name,
        description: formData.description || '',
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate,
        endDate: formData.endDate,
        completionPercentage: Number(formData.completionPercentage) || 0,
        teamLeadId: formData.teamLead.id,
        techStack: formData.techStack || [],
      });

      toast.success('Project updated');
      closeEditDrawer();
      await refreshProjectList();
      if (selectedProject?.id === editingProject.id) {
        await refreshSelectedProject();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      savingEditRef.current = false;
      setSavingEdit(false);
    }
  };

  // --- Delete Project handlers ---
  const handleDeleteProject = async () => {
    if (!projectDeleteId) return;
    setDeletingProject(true);
    try {
      await projectAPI.delete(projectDeleteId);
      toast.success('Project deleted');
      setProjectDeleteId(null);
      if (selectedProject?.id === projectDeleteId) {
        setSelectedProject(null);
        setView('list');
      }
      await refreshProjectList();
    } catch (error) {
      // Backend returns a clear message when the project has updates/documents
      // blocking deletion — surface it directly instead of a generic error.
      toast.error(getErrorMessage(error));
      setProjectDeleteId(null);
    } finally {
      setDeletingProject(false);
    }
  };

  // --- Add Update handlers ---
  const openAddUpdateDrawer = () => {
    resetUpdate({
      date: new Date().toISOString().slice(0, 10),
      workDone: '',
      gitRepo: '',
      websiteUrl: '',
      status: 'in-progress',
    });
    setPendingUpdateDocs([]);
    setUpdateDrawerOpen(true);
  };

  const closeAddUpdateDrawer = () => {
    setUpdateDrawerOpen(false);
  };

  const handleUpdateDocSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setPendingUpdateDocs((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingUpdateDoc = (index) => {
    setPendingUpdateDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDocDownload = async (doc) => {
    try {
      const { data } = await documentAPI.download(doc.id);
      downloadBlob(data, doc.title || 'document');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const onSubmitUpdate = async (formData) => {
    if (!selectedProject) return;
    setSubmittingUpdate(true);
    try {
      const fd = new FormData();
      fd.append('updateDate', formData.date);
      fd.append('updateText', formData.workDone);
      if (formData.gitRepo) fd.append('gitRepo', formData.gitRepo);
      if (formData.websiteUrl) fd.append('websiteUrl', formData.websiteUrl);
      fd.append('status', formData.status);
      pendingUpdateDocs.forEach((file) => fd.append('documents', file));

      await projectAPI.addUpdate(selectedProject.id, fd);

      toast.success('Update added — admin and team lead have been notified');
      closeAddUpdateDrawer();
      await refreshSelectedProject();
      await fetchProjectUpdates(selectedProject.id, updatesPagination.page, updatesPagination.limit);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // --- Project document handlers ---
  const handleProjectDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;
    const fd = new FormData();
    fd.append('document', file);
    fd.append('projectId', selectedProject.id);
    fd.append('type', 'other');
    fd.append('title', file.name);
    try {
      await documentAPI.upload(fd);
      toast.success('Document uploaded');
      fetchProjectDocs(selectedProject.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleProjectDocDelete = async (id) => {
    try {
      await documentAPI.delete(id);
      toast.success('Document deleted');
      fetchProjectDocs(selectedProject.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setDocDeleteId(null);
  };

  if (loading) return <Loader />;

  if (selectedProject && view === 'detail') {
    const memberCount = selectedProject.member_count ?? (selectedProject.members || []).length;
    const projectOnlyDocs = projectDocs.filter((d) => !d.project_update_id);

    const renderUrl = (value) => {
      if (!value) return '—';
      return (
        <Typography
          component="a"
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          color="primary"
          sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          {value}
        </Typography>
      );
    };

    const updateColumns = [
      { field: 'author_name', headerName: 'Employee', minWidth: 140 },
      { field: 'update_date', headerName: 'Date', minWidth: 110, renderCell: ({ value }) => formatDate(value) },
      { field: 'update_text', headerName: 'Work Done', minWidth: 220 },
      { field: 'git_repo', headerName: 'Git Repo', minWidth: 160, renderCell: ({ value }) => renderUrl(value) },
      {
        field: 'website_url',
        headerName: 'Website URL',
        minWidth: 160,
        renderCell: ({ row, value }) => renderUrl(value || row.credentials),
      },
      {
        field: 'documents',
        headerName: 'Documents',
        minWidth: 180,
        renderCell: ({ row }) => {
          const docs = row.documents || [];
          if (!docs.length) return '—';
          return (
            <Box display="flex" flexDirection="column" gap={0.5}>
              {docs.map((doc) => (
                <Typography
                  key={doc.id}
                  component="button"
                  onClick={() => handleUpdateDocDownload(doc)}
                  variant="caption"
                  color="primary"
                  sx={{ border: 'none', bgcolor: 'transparent', cursor: 'pointer', textAlign: 'left', p: 0 }}
                >
                  {doc.title}
                </Typography>
              ))}
            </Box>
          );
        },
      },
      { field: 'status', headerName: 'Status', minWidth: 110, renderCell: ({ value }) => (value ? <StatusBadge status={value} label={value} /> : '—') },
    ];

    return (
      <Box>
        <Grid container spacing={2} mb={2} alignItems="stretch">
          {/* Project Details */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card title={selectedProject.name} sx={{ height: '100%' }}>
              <Typography variant="body2" color="text.secondary" mb={1.5} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {selectedProject.description || 'No description'}
              </Typography>
              <DetailRow label="Status" value={<StatusBadge status={selectedProject.status} />} />
              <DetailRow label="Team Lead" value={selectedProject.manager_name} />
              <DetailRow label="Start Date" value={formatDate(selectedProject.start_date)} />
              <DetailRow label="End Date" value={formatDate(selectedProject.end_date)} />
              <Box py={0.75}>
                <Typography variant="body2" color="text.secondary" mb={0.75}>Tech Stack · {memberCount} member{memberCount === 1 ? '' : 's'}</Typography>
                <Box display="flex" flexWrap="wrap" gap={0.75}>
                  {(selectedProject.tech_stack || []).length
                    ? selectedProject.tech_stack.map((t) => (
                      <Chip key={t} label={t} size="small" />
                    ))
                    : <Typography variant="body2" color="text.secondary">—</Typography>}
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Project Documents */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Card title="Documents of the Project" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }} action={
              canManageProjects && (
                <>
                  <input type="file" id="project-doc-upload" hidden onChange={handleProjectDocUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx" />
                  <label htmlFor="project-doc-upload">
                    <Button component="span" size="small" startIcon={<Upload size={16} />}>Upload</Button>
                  </label>
                </>
              )
            }>
              <Box sx={{
                flex: 1,
                maxHeight: 220,
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}>
                {docsLoading ? (
                  <Typography variant="body2" color="text.secondary">Loading…</Typography>
                ) : !projectOnlyDocs.length ? (
                  <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
                ) : (
                  <Box display="flex" flexDirection="column" gap={1}>
                    {projectOnlyDocs.map((doc) => (
                      <Box
                        key={doc.id}
                        display="flex"
                        alignItems="center"
                        gap={1}
                        p={1}
                        border={`1px solid ${colors.border}`}
                        borderRadius={2}
                      >
                        <FileText size={16} color={colors.primary} />
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={500} noWrap>{doc.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatDate(doc.created_at)}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => handleUpdateDocDownload(doc)}>
                          <Download size={14} />
                        </IconButton>
                        {canManageProjects && (
                          <IconButton size="small" color="error" onClick={() => setDocDeleteId(doc.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>

          {/* Actions */}
          <Grid size={{ xs: 12, lg: 3 }}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0 }}>
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1, justifyContent: 'center' }}>
                <Button fullWidth startIcon={<Plus size={16} />} onClick={openAddUpdateDrawer}>
                  Add Update
                </Button>

                {canManageProjects && (
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Pencil size={14} />}
                      onClick={() => openEditDrawer(selectedProject)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      startIcon={<Trash2 size={14} />}
                      onClick={() => setProjectDeleteId(selectedProject.id)}
                    >
                      Delete
                    </Button>
                  </Box>
                )}
              </Box>

              <Divider />

              <Box sx={{ p: 1.5 }}>
                <Button
                  variant="text"
                  fullWidth
                  onClick={() => {
                    setSelectedProject(null);
                    setView('list');
                    refreshProjectList();
                  }}
                  sx={{ color: 'text.secondary' }}
                >
                  ← Back to List
                </Button>
              </Box>
            </Card>
          </Grid>
        </Grid>

        <Card title="Project Updates" sx={{ mb: 2 }}>
          <DataTable
            columns={updateColumns}
            rows={projectUpdates}
            loading={updatesLoading}
            emptyTitle="No updates yet"
            emptyDescription="Team members can log progress using Add Update."
            pagination={updatesPagination}
            onPageChange={(page) => fetchProjectUpdates(selectedProject.id, page, updatesPagination.limit)}
            onRowsPerPageChange={(limit) => fetchProjectUpdates(selectedProject.id, 1, limit)}
          />
        </Card>

        {/* Add Update Drawer */}
        <Drawer
          anchor="right"
          open={updateDrawerOpen}
          onClose={closeAddUpdateDrawer}
          sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: DRAWER_WIDTH } } }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', p: 3, pb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>Add Update</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Log progress for {selectedProject.name}
                </Typography>
              </Box>
              <IconButton onClick={closeAddUpdateDrawer} size="small">
                <X size={20} />
              </IconButton>
            </Box>

            <Divider />

            <Box sx={{
              flex: 1,
              overflowY: 'auto',
              p: 3,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={updateErrors.date?.message}
                    {...registerUpdate('date', { required: 'Date is required' })}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Work Done"
                    multiline
                    rows={4}
                    placeholder="Describe the work completed"
                    error={updateErrors.workDone?.message}
                    {...registerUpdate('workDone', { required: 'Work done is required' })}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Git Repo (optional)"
                    placeholder="https://github.com/org/repo"
                    {...registerUpdate('gitRepo')}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Website URL (optional)"
                    placeholder="https://example.com"
                    {...registerUpdate('websiteUrl')}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" fontWeight={500} mb={1}>Upload Documents (optional)</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    PDF, Word, Excel, or image files
                  </Typography>
                  <input
                    type="file"
                    id="update-doc-upload"
                    hidden
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                    onChange={handleUpdateDocSelect}
                  />
                  <label htmlFor="update-doc-upload">
                    <Button component="span" variant="outlined" startIcon={<Upload size={16} />} size="small">
                      Add Files
                    </Button>
                  </label>
                  <Box mt={1} display="flex" flexDirection="column" gap={1}>
                    {pendingUpdateDocs.map((file, index) => (
                      <Box
                        key={index}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        p={1}
                        border={`1px solid ${colors.border}`}
                        borderRadius={2}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <FileText size={16} />
                          <Typography variant="body2" noWrap>{file.name}</Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => removePendingUpdateDoc(index)}>
                          <X size={14} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="status"
                    control={controlUpdate}
                    rules={{ required: 'Status is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!updateErrors.status}>
                        <InputLabel id="update-status-label">Status</InputLabel>
                        <Select
                          {...field}
                          labelId="update-status-label"
                          label="Status"
                        >
                          {UPDATE_STATUS_OPTIONS.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                        {updateErrors.status && (
                          <FormHelperText>{updateErrors.status.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button variant="outlined" onClick={closeAddUpdateDrawer}>Cancel</Button>
              <Button onClick={handleSubmitUpdate(onSubmitUpdate)} loading={submittingUpdate}>Save Update</Button>
            </Box>
          </Box>
        </Drawer>

        <ConfirmDialog
          open={!!docDeleteId}
          onClose={() => setDocDeleteId(null)}
          onConfirm={() => handleProjectDocDelete(docDeleteId)}
          title="Delete Document"
          message="Are you sure you want to delete this document?"
          confirmLabel="Delete"
          danger
        />

        {canManageProjects && (
          <EditProjectDrawer
            open={editDrawerOpen}
            onClose={closeEditDrawer}
            editingProject={editingProject}
            registerEdit={registerEdit}
            controlEdit={controlEdit}
            editErrors={editErrors}
            handleSubmitEdit={handleSubmitEdit}
            onSubmitEdit={onSubmitEdit}
            savingEdit={savingEdit}
            teamLeadOptions={teamLeadOptions}
            formId="edit-project-form-detail"
          />
        )}

        <ConfirmDialog
          open={!!projectDeleteId}
          onClose={() => setProjectDeleteId(null)}
          onConfirm={handleDeleteProject}
          title="Delete Project"
          message="Are you sure you want to delete this project? This can't be undone. Projects with existing updates or documents can't be deleted — remove those first."
          confirmLabel="Delete"
          danger
          loading={deletingProject}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" gap={2} mb={2} alignItems="center" flexWrap="nowrap">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search projects..." fullWidth />
        </Box>
        {canManageProjects && (
          <Button startIcon={<Plus size={18} />} onClick={openAddDrawer} sx={{ flexShrink: 0 }}>
            Add Project
          </Button>
        )}
      </Box>

      {!projects.length ? (
        <EmptyState title="No projects" description="No projects found matching your criteria." />
      ) : (
        <Grid container spacing={3}>
          {projects.map((p) => (
            <Grid key={p.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card sx={{ cursor: 'pointer' }}>
                <Box onClick={() => loadProject(p.id)}>
                  <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
                    <Typography variant="h6" fontWeight={600}>{p.name}</Typography>
                    {canManageProjects && (
                      <Box display="flex" gap={0.5} flexShrink={0} onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={() => openEditDrawer(p)} aria-label="Edit project">
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setProjectDeleteId(p.id)} aria-label="Delete project">
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </Typography>
                  <StatusBadge status={p.status} />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {canManageProjects && (
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={closeAddDrawer}
          sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: DRAWER_WIDTH } } }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', p: 3, pb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>Add Project</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Create a project and assign a team
                </Typography>
              </Box>
              <IconButton onClick={closeAddDrawer} size="small">
                <X size={20} />
              </IconButton>
            </Box>

            <Divider />

            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }} component="form" id="add-project-form" onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Project Name"
                    error={errors.name?.message}
                    {...register('name', { required: 'Project name is required' })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Input label="Description" multiline rows={2} {...register('description')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Input
                    label="Start Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={errors.startDate?.message}
                    {...register('startDate', { required: 'Required' })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Input
                    label="End Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    error={errors.endDate?.message}
                    {...register('endDate', { required: 'Required' })}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="teamLead"
                    control={control}
                    rules={{ required: 'Team lead is required' }}
                    render={({ field }) => (
                      <Autocomplete
                        options={teamLeadOptions}
                        getOptionLabel={(opt) => opt.label || ''}
                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                        value={field.value || null}
                        onChange={(_, value) => field.onChange(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Team Lead"
                            placeholder="Select a team lead"
                            error={!!errors.teamLead}
                            helperText={errors.teamLead?.message || 'Only employees with Team Lead role are shown'}
                          />
                        )}
                      />
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="employees"
                    control={control}
                    defaultValue={[]}
                    render={({ field }) => (
                      <Autocomplete
                        multiple
                        options={employeeOptions}
                        getOptionLabel={(opt) => opt.label || ''}
                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                        value={field.value || []}
                        onChange={(_, value) => field.onChange(value)}
                        renderTags={(value, getTagProps) =>
                          value.map((opt, index) => (
                            <Chip label={opt.label} {...getTagProps({ index })} key={opt.id} size="small" />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Employees" placeholder="Add team members" />
                        )}
                      />
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="techStack"
                    control={control}
                    defaultValue={[]}
                    render={({ field }) => (
                      <Autocomplete
                        multiple
                        freeSolo
                        options={TECH_SUGGESTIONS}
                        value={field.value || []}
                        onChange={(_, value) => field.onChange(value)}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip label={option} {...getTagProps({ index })} key={option} size="small" />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Tech Stack" placeholder="Type and press enter" />
                        )}
                      />
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" fontWeight={500} mb={1}>Project Documentation (optional)</Typography>
                  <input type="file" id="new-project-docs" hidden multiple onChange={handlePendingDocSelect} />
                  <label htmlFor="new-project-docs">
                    <Button component="span" variant="outlined" startIcon={<Upload size={16} />} size="small">
                      Add Files
                    </Button>
                  </label>
                  <Box mt={1} display="flex" flexDirection="column" gap={1}>
                    {pendingDocs.map((file, index) => (
                      <Box
                        key={index}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        p={1}
                        border={`1px solid ${colors.border}`}
                        borderRadius={2}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <FileText size={16} />
                          <Typography variant="body2" noWrap>{file.name}</Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => removePendingDoc(index)}>
                          <X size={14} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button variant="outlined" onClick={closeAddDrawer} type="button">Cancel</Button>
              <Button type="submit" form="add-project-form" loading={submitting} disabled={creatingProject}>
                Create Project
              </Button>
            </Box>
          </Box>
        </Drawer>
      )}

      {canManageProjects && (
        <EditProjectDrawer
          open={editDrawerOpen}
          onClose={closeEditDrawer}
          editingProject={editingProject}
          registerEdit={registerEdit}
          controlEdit={controlEdit}
          editErrors={editErrors}
          handleSubmitEdit={handleSubmitEdit}
          onSubmitEdit={onSubmitEdit}
          savingEdit={savingEdit}
          teamLeadOptions={teamLeadOptions}
          formId="edit-project-form-list"
        />
      )}

      <ConfirmDialog
        open={!!projectDeleteId}
        onClose={() => setProjectDeleteId(null)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? This can't be undone. Projects with existing updates or documents can't be deleted — remove those first."
        confirmLabel="Delete"
        danger
        loading={deletingProject}
      />
    </Box>
  );
};

// Shared Edit Project drawer, rendered from both the list view and the
// detail view (each with a distinct formId so their <form> ids never clash).
const EditProjectDrawer = ({
  open, onClose, editingProject, registerEdit, controlEdit, editErrors,
  handleSubmitEdit, onSubmitEdit, savingEdit, teamLeadOptions, formId,
}) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={onClose}
    sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: DRAWER_WIDTH } } }}
  >
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', p: 3, pb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Edit Project</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {editingProject?.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }} component="form" id={formId} onSubmit={handleSubmitEdit(onSubmitEdit)}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Input
              label="Project Name"
              error={editErrors.name?.message}
              {...registerEdit('name', { required: 'Project name is required' })}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Input label="Description" multiline rows={2} {...registerEdit('description')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Input
              label="Start Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              error={editErrors.startDate?.message}
              {...registerEdit('startDate', { required: 'Required' })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Input
              label="End Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              error={editErrors.endDate?.message}
              {...registerEdit('endDate', { required: 'Required' })}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="status"
              control={controlEdit}
              rules={{ required: 'Status is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!editErrors.status}>
                  <InputLabel id={`${formId}-status-label`}>Status</InputLabel>
                  <Select {...field} labelId={`${formId}-status-label`} label="Status">
                    {PROJECT_STATUS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                  {editErrors.status && <FormHelperText>{editErrors.status.message}</FormHelperText>}
                </FormControl>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="priority"
              control={controlEdit}
              rules={{ required: 'Priority is required' }}
              render={({ field }) => (
                <FormControl fullWidth error={!!editErrors.priority}>
                  <InputLabel id={`${formId}-priority-label`}>Priority</InputLabel>
                  <Select {...field} labelId={`${formId}-priority-label`} label="Priority">
                    {PROJECT_PRIORITY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                  {editErrors.priority && <FormHelperText>{editErrors.priority.message}</FormHelperText>}
                </FormControl>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Input
              label="Completion %"
              type="number"
              inputProps={{ min: 0, max: 100 }}
              error={editErrors.completionPercentage?.message}
              {...registerEdit('completionPercentage', {
                min: { value: 0, message: 'Must be 0 or more' },
                max: { value: 100, message: 'Must be 100 or less' },
              })}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="teamLead"
              control={controlEdit}
              rules={{ required: 'Team lead is required' }}
              render={({ field }) => (
                <Autocomplete
                  options={teamLeadOptions}
                  getOptionLabel={(opt) => opt.label || ''}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  value={field.value || null}
                  onChange={(_, value) => field.onChange(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Team Lead"
                      placeholder="Select a team lead"
                      error={!!editErrors.teamLead}
                      helperText={editErrors.teamLead?.message || 'Only employees with Team Lead role are shown'}
                    />
                  )}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="techStack"
              control={controlEdit}
              defaultValue={[]}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  freeSolo
                  options={TECH_SUGGESTIONS}
                  value={field.value || []}
                  onChange={(_, value) => field.onChange(value)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip label={option} {...getTagProps({ index })} key={option} size="small" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Tech Stack" placeholder="Type and press enter" />
                  )}
                />
              )}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider />

      <Box sx={{ p: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button variant="outlined" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form={formId} loading={savingEdit} disabled={savingEdit}>
          Save Changes
        </Button>
      </Box>
    </Box>
  </Drawer>
);

export default Projects;