import { Link } from 'react-router-dom';
import { Eye, Download, Trash2, Loader2 } from 'lucide-react';
import { deleteMeeting } from '@/lib/meetings';

const statusColors = {
  completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  processing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  pending: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function MeetingTable({ meetings, onDelete }) {
  const handleDelete = async (id) => {
    if (!confirm('Delete this meeting?')) return;
    await deleteMeeting(id);
    onDelete?.();
  };

  const handleDownload = (meeting) => {
    const content = `MINUTES OF MEETING\n\nTitle: ${meeting.title}\nDepartment: ${meeting.department}\nDate: ${new Date(meeting.created_at).toLocaleDateString()}\n\n${meeting.mom_content ? JSON.stringify(meeting.mom_content, null, 2) : 'No MoM generated yet.'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title}-MoM.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!meetings?.length) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No meetings found</p>
        <p className="text-sm mt-1">Upload audio to generate your first MoM</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {['Meeting', 'Department', 'Date', 'Duration', 'Status', 'AI Confidence', 'Actions'].map(h => (
              <th key={h} className="text-left text-gray-500 font-medium py-3 px-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => (
            <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="py-3 px-4 text-white font-medium">{m.title}</td>
              <td className="py-3 px-4 text-gray-400">{m.department || '—'}</td>
              <td className="py-3 px-4 text-gray-400">{new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td className="py-3 px-4 text-gray-400">{m.duration_seconds ? `${Math.round(m.duration_seconds / 60)} min` : '—'}</td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[m.status] || statusColors.pending}`}>
                  {m.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {m.status?.charAt(0).toUpperCase() + m.status?.slice(1) || 'Pending'}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-400">{m.confidence ? `${m.confidence}%` : '—'}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  <Link to={`/meetings/${m.id}`} className="w-8 h-8 rounded-lg hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 flex items-center justify-center transition-all">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleDownload(m)} className="w-8 h-8 rounded-lg hover:bg-green-500/10 text-gray-500 hover:text-green-400 flex items-center justify-center transition-all">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 flex items-center justify-center transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}