import { useEffect, useState } from 'react';
import { Grid, Box, Typography, Autocomplete, TextField } from '@mui/material';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { documentAPI, employeeAPI } from '../../services/services';
import {
  Card, Button, Select, EmptyState, Loader, ConfirmDialog,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatDate, getErrorMessage, downloadBlob } from '../../utils/helpers';

const DOC_TYPES = [
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'experience_letter', label: 'Experience Letter' },
  { value: 'relieving_letter', label: 'Relieving Letter' },
  { value: 'company_policy', label: 'Company Policy' },
  { value: 'salary_revision', label: 'Salary Revision Letter' },
  { value: 'other', label: 'Other' },
];

const Documents = () => {
  const { isAdmin, isAdminOnly, isHr, user } = useAuth();
  const canUpload = isAdminOnly || isHr;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [uploadType, setUploadType] = useState('offer_letter');

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = typeFilter ? { type: typeFilter } : {};
      if (canUpload) {
        if (selectedEmployee?.id) {
          params.employeeId = selectedEmployee.id;
        } else {
          setDocuments([]);
          setLoading(false);
          return;
        }
        const { data } = await documentAPI.getAll(params);
        setDocuments(data.data || []);
      } else {
        const { data } = await documentAPI.getMy(params);
        setDocuments(data.data || []);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canUpload) {
      employeeAPI.getAll({ limit: 200, status: 'active' })
        .then(({ data }) => setEmployees(data.data || []))
        .catch(() => {});
    }
  }, [canUpload]);

  useEffect(() => {
    fetchDocs();
  }, [typeFilter, canUpload, selectedEmployee?.id]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetEmpId = canUpload ? selectedEmployee?.id : user?.empId;
    if (!targetEmpId) {
      toast.error('Select an employee before uploading');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', uploadType || 'other');
    formData.append('title', file.name);
    formData.append('employeeId', targetEmpId);

    try {
      const { data } = await documentAPI.upload(formData);
      toast.success(data.emailSent ? 'Document uploaded and employee notified' : 'Document uploaded');
      fetchDocs();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    e.target.value = '';
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

  const handleDownload = async (doc) => {
    try {
      const { data } = await documentAPI.download(doc.id);
      downloadBlob(data, doc.title || 'document');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const getTypeLabel = (type) => DOC_TYPES.find((t) => t.value === type)?.label || type;

  if (loading) return <Loader />;

  return (
    <Box>
      <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="wrap">
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Select
            label="Document Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[{ value: '', label: 'All Types' }, ...DOC_TYPES]}
            fullWidth
          />
        </Box>
        {canUpload && (
          <>
            <Box sx={{ minWidth: 240 }}>
              <Autocomplete
                options={employees}
                getOptionLabel={(o) => `${o.first_name} ${o.last_name} (${o.employee_id})`}
                value={selectedEmployee}
                onChange={(_, v) => setSelectedEmployee(v)}
                renderInput={(params) => <TextField {...params} label="Employee" size="small" />}
              />
            </Box>
            <Box sx={{ width: 180 }}>
              <Select
                label="Upload Type"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                options={DOC_TYPES}
                fullWidth
              />
            </Box>
            <input type="file" id="doc-upload" hidden accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleUpload} />
            <label htmlFor="doc-upload">
              <Button component="span" startIcon={<Upload size={18} />}>Upload Document</Button>
            </label>
          </>
        )}
      </Box>

      {!documents.length ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description={canUpload && !selectedEmployee ? 'Select an employee to view or upload their documents.' : 'Upload or request documents from HR.'}
        />
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
                  <Button size="small" variant="outlined" startIcon={<Download size={14} />} onClick={() => handleDownload(doc)}>
                    Download
                  </Button>
                  {isAdminOnly && (
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