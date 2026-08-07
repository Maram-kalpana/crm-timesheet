import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Box, Typography, LinearProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { projectAPI } from '../../services/services';
import {
  PageHeader, Card, Button, SearchBar, StatusBadge, Loader, EmptyState,
} from '../../components/ui';
import { colors } from '../../theme';
import { getErrorMessage } from '../../utils/helpers';

const KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', color: colors.text.secondary },
  { id: 'in-progress', title: 'In Progress', color: colors.primary },
  { id: 'review', title: 'Review', color: colors.warning },
  { id: 'done', title: 'Done', color: colors.success },
];

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const navigate = useNavigate();

  useEffect(() => {
    projectAPI.getAll({ search })
      .then(({ data }) => setProjects(data.data))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [search]);

  const loadProject = async (id) => {
    try {
      const { data } = await projectAPI.getById(id);
      setSelectedProject(data.data);
      setView('kanban');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
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
              <Button variant="outlined" onClick={() => { setSelectedProject(null); setView('list'); }}>Back to List</Button>
              <ToggleButtonGroup value={view} exclusive size="small">
                <ToggleButton value="kanban"><LayoutGrid size={16} /></ToggleButton>
                <ToggleButton value="list"><List size={16} /></ToggleButton>
              </ToggleButtonGroup>
            </Box>
          }
        />

        <Card sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography fontWeight={600}>Progress</Typography>
            <Typography color="text.secondary">{selectedProject.completion_percentage}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={selectedProject.completion_percentage} sx={{ height: 10, borderRadius: 2 }} />
          <Box display="flex" gap={2} mt={2}>
            <StatusBadge status={selectedProject.status} />
            <Typography variant="body2" color="text.secondary">{selectedProject.member_count} members · {selectedProject.task_count} tasks</Typography>
          </Box>
        </Card>

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
                  <Typography variant="body2">{u.update_text}</Typography>
                  <Typography variant="caption" color="text.secondary">{u.author_name} · {u.hours_spent}h</Typography>
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
            </Card>
          </Grid>
        </Grid>
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

      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <SearchBar value={search} onChange={setSearch} placeholder="Search projects..." sx={{ maxWidth: 320 }} />
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
    </Box>
  );
};

export default Projects;
