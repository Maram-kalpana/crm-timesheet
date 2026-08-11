import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Box, Typography, LinearProgress, ToggleButton, ToggleButtonGroup,
  Autocomplete, TextField, Chip, Drawer, IconButton, Divider,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import { LayoutGrid, List, Plus, X, Upload, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { projectAPI, employeeAPI, documentAPI } from '../../services/services';
import {
  PageHeader, Card, Button, SearchBar, StatusBadge, Loader, EmptyState, Input, ConfirmDialog,
} from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage, getFullName } from '../../utils/helpers';

const KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', color: colors.text.secondary },
  { id: 'in-progress', title: 'In Progress', color: colors.primary },
  { id: 'review', title: 'Review', color: colors.warning },
  { id: 'done', title: 'Done', color: colors.success },
];

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

const DRAWER_WIDTH = 480;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const DetailRow = ({ label, value }) => (
  <Box display="flex" justifyContent="space-between" py={0.75}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={500} textAlign="right">{value ?? '—'}</Typography>
  </Box>
);

const Projects = () => {
  const { isAdminOnly } = useAuth();
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
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  // --- Initial documentation files for Add Project ---
  const [pendingDocs, setPendingDocs] = useState([]);

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
      credentials: '',
      status: 'in-progress',
    },
  });

  // --- Project documents ---
  const [projectDocs, setProjectDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docDeleteId, setDocDeleteId] = useState(null);

  useEffect(() => {
    projectAPI.getAll({ search, limit: 100 })
      .then(({ data }) => setProjects(data.data || []))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    if (!isAdminOnly || !drawerOpen) return;
    employeeAPI.getTeamLeads()
      .then(({ data }) => setTeamLeads(data.data || []))
      .catch(() => setTeamLeads([]));
    employeeAPI.getAssignable()
      .then(({ data }) => setEmployees(data.data || []))
      .catch(() => setEmployees([]));
  }, [isAdminOnly, drawerOpen]);

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

  const loadProject = async (id) => {
    try {
      const { data } = await projectAPI.getById(id);
      setSelectedProject(data.data);
      setView('kanban');
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
    if (creatingProject) return;
    if (!formData.teamLead) {
      toast.error('Please select a team lead');
      return;
    }
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

      if (newProjectId && pendingDocs.length) {
        for (const file of pendingDocs) {
          const fd = new FormData();
          fd.append('document', file);
          fd.append('projectId', newProjectId);
          fd.append('type', 'other');
          fd.append('title', file.name);
          await documentAPI.upload(fd);
        }
      }

      toast.success('Project created successfully');
      closeAddDrawer();
      reset();
      setPendingDocs([]);
      const { data } = await projectAPI.getAll({ search, limit: 100 });
      setProjects(data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
      setCreatingProject(false);
    }
  };

  // --- Add Update handlers ---
  const openAddUpdateDrawer = () => {
    resetUpdate({
      date: new Date().toISOString().slice(0, 10),
      workDone: '',
      gitRepo: '',
      credentials: '',
      status: 'in-progress',
    });
    setUpdateDrawerOpen(true);
  };

  const closeAddUpdateDrawer = () => {
    setUpdateDrawerOpen(false);
  };

  const onSubmitUpdate = async (formData) => {
    if (!selectedProject) return;
    setSubmittingUpdate(true);
    try {
      await projectAPI.addUpdate(selectedProject.id, {
        updateDate: formData.date,
        updateText: formData.workDone,
        gitRepo: formData.gitRepo || '',
        credentials: formData.credentials || '',
        status: formData.status,
      });

      toast.success('Update added — admin and team lead have been notified');
      closeAddUpdateDrawer();
      await refreshSelectedProject();
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

  if (selectedProject && view === 'kanban') {
    const tasksByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
      acc[col.id] = (selectedProject.tasks || []).filter((t) => t.status === col.id);
      return acc;
    }, {});

    return (
      <Box>
        <PageHeader
          title={selectedProject.name}
          subtitle={selectedProject.description}
          breadcrumb={[
            { label: 'Projects', path: '/projects' },
            { label: selectedProject.name },
          ]}
          action={
            <Box display="flex" gap={1}>
              <Button variant="outlined" onClick={() => {
                setSelectedProject(null);
                setView('list');
                projectAPI.getAll({ search, limit: 100 })
                  .then(({ data }) => setProjects(data.data || []))
                  .catch(() => {});
              }}>Back to List</Button>
              <Button startIcon={<Plus size={16} />} onClick={openAddUpdateDrawer}>Add Update</Button>
              <ToggleButtonGroup value={view} exclusive size="small">
                <ToggleButton value="kanban"><LayoutGrid size={16} /></ToggleButton>
                <ToggleButton value="list"><List size={16} /></ToggleButton>
              </ToggleButtonGroup>
            </Box>
          }
        />

        <Grid container spacing={3} mb={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card sx={{ height: '100%' }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography fontWeight={600}>Progress</Typography>
                <Typography color="text.secondary">{selectedProject.completion_percentage ?? 0}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={selectedProject.completion_percentage ?? 0}
                sx={{ height: 10, borderRadius: 2 }}
              />
              <Box display="flex" gap={2} mt={2} alignItems="center">
                <StatusBadge status={selectedProject.status} />
                <Typography variant="body2" color="text.secondary">
                  {selectedProject.member_count ?? 0} members · {selectedProject.task_count ?? 0} tasks
                </Typography>
              </Box>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card title="Project Details" sx={{ height: '100%' }}>
              <DetailRow label="Team Lead" value={selectedProject.manager_name} />
              <DetailRow label="Start Date" value={formatDate(selectedProject.start_date)} />
              <DetailRow label="End Date" value={formatDate(selectedProject.end_date)} />
              <Box py={0.75}>
                <Typography variant="body2" color="text.secondary" mb={0.75}>Tech Stack</Typography>
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
        </Grid>

        <Grid container spacing={2}>
          {KANBAN_COLUMNS.map((col) => (
            <Grid key={col.id} size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ bgcolor: colors.background, borderRadius: 3, p: 2, minHeight: 400 }}>
                <Typography fontWeight={600} color={col.color} mb={2}>{col.title} ({tasksByStatus[col.id]?.length || 0})</Typography>
                {(tasksByStatus[col.id] || []).map((task) => (
                  <Card key={task.id} sx={{ mb: 1.5, p: 2 }} hover={false}>
                    <Typography variant="body2" fontWeight={500}>{task.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{task.assigned_to_name || 'Unassigned'}</Typography>
                    <Box mt={1}><StatusBadge status={task.priority} label={task.priority} /></Box>
                  </Card>
                ))}
              </Box>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3} mt={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card title="Activity Timeline">
              {(selectedProject.updates || []).map((u) => (
                <Box key={u.id} py={1.5} borderBottom={`1px solid ${colors.border}`}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">{formatDate(u.update_date)}</Typography>
                    {u.status && <StatusBadge status={u.status} label={u.status} />}
                  </Box>
                  <Typography variant="body2">{u.update_text}</Typography>
                  {u.git_repo && (
                    <Typography variant="caption" color="text.secondary" component="div" mt={0.5}>
                      Repo: {u.git_repo}
                    </Typography>
                  )}
                  {u.credentials && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      Credentials: {u.credentials}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" component="div" mt={0.5}>
                    {u.author_name}{u.hours_spent ? ` · ${u.hours_spent}h` : ''}
                  </Typography>
                </Box>
              ))}
              {!selectedProject.updates?.length && <Typography color="text.secondary" variant="body2">No updates yet</Typography>}
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card title="Comments">
              {(selectedProject.comments || []).map((c) => (
                <Box key={c.id} py={1.5} borderBottom={`1px solid ${colors.border}`}>
                  <Typography variant="body2" fontWeight={500}>{c.author_name}</Typography>
                  <Typography variant="body2">{c.comment}</Typography>
                </Box>
              ))}
              {!selectedProject.comments?.length && <Typography color="text.secondary" variant="body2">No comments yet</Typography>}
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card
              title="Documents"
              action={
                isAdminOnly && (
                  <>
                    <input type="file" id="project-doc-upload" hidden onChange={handleProjectDocUpload} />
                    <label htmlFor="project-doc-upload">
                      <Button component="span" size="small" startIcon={<Upload size={16} />}>Upload</Button>
                    </label>
                  </>
                )
              }
            >
              {docsLoading ? (
                <Typography variant="body2" color="text.secondary">Loading documents…</Typography>
              ) : !projectDocs.length ? (
                <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {projectDocs.map((doc) => (
                    <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1.5}
                        p={1.5}
                        border={`1px solid ${colors.border}`}
                        borderRadius={2}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${colors.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={18} color={colors.primary} />
                        </Box>
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={500} noWrap>{doc.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatDate(doc.created_at)}</Typography>
                        </Box>
                        <IconButton size="small" component="a" href={doc.file_url} target="_blank">
                          <Download size={16} />
                        </IconButton>
                        {isAdminOnly && (
                          <IconButton size="small" color="error" onClick={() => setDocDeleteId(doc.id)}>
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Card>
          </Grid>
        </Grid>

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

            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
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
                    label="Git Repo"
                    placeholder="https://github.com/org/repo"
                    error={updateErrors.gitRepo?.message}
                    {...registerUpdate('gitRepo')}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Input
                    label="Credentials (if any)"
                    placeholder="e.g. staging login, API keys location"
                    multiline
                    rows={2}
                    {...registerUpdate('credentials')}
                  />
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
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Projects"
        subtitle="Manage projects and track progress"
        breadcrumb={[{ label: 'Projects', path: '/projects' }]}
      />

      <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="nowrap">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search projects..." fullWidth />
        </Box>
        {isAdminOnly && (
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
              <Card onClick={() => loadProject(p.id)} sx={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight={600} mb={1}>{p.name}</Typography>
                <Typography variant="body2" color="text.secondary" mb={2} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.description}
                </Typography>
                <LinearProgress variant="determinate" value={p.completion_percentage} sx={{ mb: 2, borderRadius: 2, height: 8 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <StatusBadge status={p.status} />
                  <Typography variant="caption" color="text.secondary">{p.completion_percentage}%</Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {isAdminOnly && (
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
    </Box>
  );
};

export default Projects;