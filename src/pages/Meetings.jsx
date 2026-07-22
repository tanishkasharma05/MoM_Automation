import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import MeetingTable from '@/components/meetings/MeetingTable';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getMeetings } from '@/lib/meetings';
import { Search, Filter, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Meetings() {
  const { user } = useSupabaseAuth();
  const [meetings, setMeetings] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    if (!user) return;
    try {
      const data = await getMeetings(user.id);
      setMeetings(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    let result = meetings;
    if (search) result = result.filter(m => m.title?.toLowerCase().includes(search.toLowerCase()) || m.department?.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') result = result.filter(m => m.status === statusFilter);
    setFiltered(result);
  }, [search, statusFilter, meetings]);

  return (
    <AppLayout title="Meetings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold">All Meetings</h1>
            <p className="text-gray-400 text-sm">View and manage all AI-generated meeting minutes</p>
          </div>
          <Link to="/upload" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all text-sm">
            <Plus className="w-4 h-4" /> New Meeting
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or department..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="text-gray-500 text-sm mb-4">{filtered.length} meeting{filtered.length !== 1 ? 's' : ''} found</div>
              <MeetingTable meetings={filtered} onDelete={load} />
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}