import { useEffect, useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { documentAPI } from '../../services/services';
import {
  PageHeader, Card, Button, Select, EmptyState, Loader, ConfirmDialog,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, getErrorMessage } from '../../utils/helpers';

const DOC_TYPES = [
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'experience_letter', label: 'Experience Letter' },
  { value: 'relieving_letter', label: 'Relieving Letter' },
  { value: 'other', label: 'Other' },
];

const Documents = () => {
  const { isAdmin, user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data } = await documentAPI.getAll({ type: typeFilter });
      setDocuments(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [typeFilter]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', typeFilter || 'other');
    formData.append('title', file.name);
    formData.append('employeeId', user?.empId || user?.employeeId);
    try {
      await documentAPI.upload(formData);
      toast.success('Document uploaded');
      fetchDocs();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (id) => {
    try {
      await documentAPI.delete(id);
      toast.success('Document deleted');
      fetchDocs();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setDeleteId(null);
  };

  const getTypeLabel = (type) => DOC_TYPES.find((t) => t.value === type)?.label || type;

  if (loading) return <Loader />;

  return (
    <Box>
      <PageHeader
        title="Documents"
        subtitle="Employee documents and letters"
        breadcrumb={[{ label: 'Documents', path: '/documents' }]}
        action={
          isAdmin && (
            <>
              <input type="file" id="doc-upload" hidden accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleUpload} />
              <label htmlFor="doc-upload">
                <Button component="span" startIcon={<Upload size={18} />}>Upload Document</Button>
              </label>
            </>
          )
        }
      />

      <Box mb={3}>
        <Select
          label="Document Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          options={[{ value: '', label: 'All Types' }, ...DOC_TYPES]}
          sx={{ minWidth: 200 }}
        />
      </Box>

      {!documents.length ? (
        <EmptyState icon={FileText} title="No documents" description="Upload or request documents from HR." />
      ) : (
        <Grid container spacing={3}>
          {documents.map((doc) => (
            <Grid key={doc.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card hover>
                <Box display="flex" alignItems="flex-start" gap={2}>
                  <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${colors.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={24} color={colors.primary} />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography fontWeight={600} noWrap>{doc.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{getTypeLabel(doc.type)}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">{formatDate(doc.created_at)}</Typography>
                  </Box>
                </Box>
                <Box display="flex" gap={1} mt={2}>
                  <Button size="small" variant="outlined" startIcon={<Download size={14} />} component="a" href={doc.file_url} target="_blank">
                    Download
                  </Button>
                  {isAdmin && (
                    <Button size="small" variant="text" color="error" onClick={() => setDeleteId(doc.id)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="Delete Document"
        message="Are you sure you want to delete this document?"
        confirmLabel="Delete"
        danger
      />
    </Box>
  );
};

export default Documents;
