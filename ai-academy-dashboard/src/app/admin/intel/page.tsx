'use client';

import { useEffect, useState, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Zap,
  Search,
  Filter,
  X,
  AlertTriangle,
  Shield,
  FileText,
  RefreshCw,
  Send,
  Eye,
  Edit,
  Loader2,
  CheckCircle,
  Clock,
  ArrowLeft,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { IntelDrop } from '@/lib/types';

const CLASSIFICATIONS = ['URGENT', 'CLASSIFIED', 'BRIEFING'];
const TASK_FORCES = ['RHEIN', 'LYON', 'MILAN', 'AMSTERDAM'];

export default function AdminIntelPage() {
  const [allIntelDrops, setAllIntelDrops] = useState<IntelDrop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'unreleased' | 'released' | 'all'>('unreleased');

  // Dialog states
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedIntel, setSelectedIntel] = useState<IntelDrop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    classification: '',
    content: '',
    affected_task_forces: [] as string[],
    trigger_time: '',
  });

  const supabase = getSupabaseClient();

  const fetchIntelDrops = async () => {
    const { data, error } = await supabase
      .from('intel_drops')
      .select('*')
      .order('day', { ascending: true });

    if (!error && data) {
      setAllIntelDrops(data as IntelDrop[]);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchIntelDrops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIntelDrops();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDayFilter('all');
    setClassificationFilter('all');
  };

  const hasActiveFilters = searchQuery || dayFilter !== 'all' || classificationFilter !== 'all';

  // Filter intel drops
  const filteredIntelDrops = useMemo(() => {
    let filtered = [...allIntelDrops];

    // Tab filter
    if (activeTab === 'unreleased') {
      filtered = filtered.filter((intel) => !intel.is_released);
    } else if (activeTab === 'released') {
      filtered = filtered.filter((intel) => intel.is_released);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (intel) =>
          intel.title.toLowerCase().includes(query) ||
          intel.content.toLowerCase().includes(query)
      );
    }

    // Day filter
    if (dayFilter !== 'all') {
      filtered = filtered.filter((intel) => intel.day === parseInt(dayFilter));
    }

    // Classification filter
    if (classificationFilter !== 'all') {
      filtered = filtered.filter((intel) => intel.classification === classificationFilter);
    }

    return filtered;
  }, [allIntelDrops, activeTab, searchQuery, dayFilter, classificationFilter]);

  // Stats
  const unreleasedCount = allIntelDrops.filter((i) => !i.is_released).length;
  const releasedCount = allIntelDrops.filter((i) => i.is_released).length;
  const urgentCount = allIntelDrops.filter((i) => i.classification === 'URGENT' && !i.is_released).length;

  // Get unique days
  const uniqueDays = [...new Set(allIntelDrops.map((i) => i.day))].sort((a, b) => a - b);

  // Release handler
  const handleReleaseClick = (intel: IntelDrop) => {
    setSelectedIntel(intel);
    setReleaseDialogOpen(true);
  };

  const handleConfirmRelease = async () => {
    if (!selectedIntel) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('intel_drops')
        .update({
          is_released: true,
          released_at: new Date().toISOString(),
        })
        .eq('id', selectedIntel.id);

      if (error) throw error;

      toast.success(`Intel Drop "${selectedIntel.title}" released successfully`);
      setReleaseDialogOpen(false);
      setSelectedIntel(null);
      fetchIntelDrops();
    } catch (error) {
      toast.error('Failed to release Intel Drop');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit handler
  const handleEditClick = (intel: IntelDrop) => {
    setSelectedIntel(intel);
    setEditForm({
      title: intel.title,
      classification: intel.classification,
      content: intel.content,
      affected_task_forces: intel.affected_task_forces || [],
      trigger_time: intel.trigger_time || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedIntel) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('intel_drops')
        .update({
          title: editForm.title,
          classification: editForm.classification,
          content: editForm.content,
          affected_task_forces: editForm.affected_task_forces.length > 0 ? editForm.affected_task_forces : null,
          trigger_time: editForm.trigger_time || null,
        })
        .eq('id', selectedIntel.id);

      if (error) throw error;

      toast.success('Intel Drop updated successfully');
      setEditDialogOpen(false);
      setSelectedIntel(null);
      fetchIntelDrops();
    } catch (error) {
      toast.error('Failed to update Intel Drop');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview handler
  const handlePreviewClick = (intel: IntelDrop) => {
    setSelectedIntel(intel);
    setPreviewDialogOpen(true);
  };

  // Task force toggle
  const toggleTaskForce = (tf: string) => {
    if (editForm.affected_task_forces.includes(tf)) {
      setEditForm({
        ...editForm,
        affected_task_forces: editForm.affected_task_forces.filter((t) => t !== tf),
      });
    } else {
      setEditForm({
        ...editForm,
        affected_task_forces: [...editForm.affected_task_forces, tf],
      });
    }
  };

  // Classification badge color
  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'URGENT':
        return <Badge variant="destructive" className="animate-pulse">{classification}</Badge>;
      case 'CLASSIFIED':
        return <Badge className="bg-amber-500">{classification}</Badge>;
      default:
        return <Badge className="bg-blue-500">{classification}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Intel Drops Management</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>Intel Drops</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-500" />
            Intel Drops Management
          </h1>
          <p className="text-muted-foreground">Release and manage intelligence briefings</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Release
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{unreleasedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Released
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{releasedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Urgent Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{urgentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Intel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{allIntelDrops.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="unreleased" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {unreleasedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {unreleasedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="released" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Released
            <Badge variant="secondary" className="ml-1">
              {releasedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            All
            <Badge variant="secondary" className="ml-1">
              {allIntelDrops.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Day Filter */}
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  {uniqueDays.map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Day {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Classification Filter */}
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Active filters display */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary">
                    Search: &quot;{searchQuery}&quot;
                  </Badge>
                )}
                {dayFilter !== 'all' && (
                  <Badge variant="secondary">Day: {dayFilter}</Badge>
                )}
                {classificationFilter !== 'all' && (
                  <Badge variant="secondary">{classificationFilter}</Badge>
                )}
                <span className="text-sm text-muted-foreground ml-2">
                  ({filteredIntelDrops.length} results)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table Content */}
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                {activeTab === 'unreleased' ? 'Pending Intel Drops' : activeTab === 'released' ? 'Released Intel Drops' : 'All Intel Drops'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredIntelDrops.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No intel drops found</p>
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? 'Try changing filters.' : 'No intel drops available.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Task Forces</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Released At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIntelDrops.map((intel) => (
                      <TableRow key={intel.id}>
                        <TableCell>
                          <Badge variant="outline">Day {intel.day}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{intel.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {intel.content.substring(0, 80)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getClassificationBadge(intel.classification)}
                        </TableCell>
                        <TableCell>
                          {intel.affected_task_forces && intel.affected_task_forces.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {intel.affected_task_forces.map((tf) => (
                                <Badge key={tf} variant="secondary" className="text-xs">
                                  {tf}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">All teams</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {intel.is_released ? (
                            <Badge className="bg-green-500">Released</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {intel.released_at
                            ? format(new Date(intel.released_at), 'MMM d, HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePreviewClick(intel)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditClick(intel)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!intel.is_released && (
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600"
                                onClick={() => handleReleaseClick(intel)}
                              >
                                <Send className="mr-1 h-4 w-4" />
                                Release
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Release Confirmation Dialog */}
      <AlertDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Release
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to release this Intel Drop? This action will make it visible to all participants immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedIntel && (
            <div className="my-4 p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                {getClassificationBadge(selectedIntel.classification)}
                <Badge variant="outline">Day {selectedIntel.day}</Badge>
              </div>
              <p className="font-medium">{selectedIntel.title}</p>
              {selectedIntel.affected_task_forces && selectedIntel.affected_task_forces.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Affects: {selectedIntel.affected_task_forces.join(', ')}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRelease}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Release Intel Drop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Intel Drop
            </DialogTitle>
            <DialogDescription>
              Update the content and settings of this Intel Drop
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classification">Classification</Label>
                <Select
                  value={editForm.classification}
                  onValueChange={(v) => setEditForm({ ...editForm, classification: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICATIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger_time">Trigger Time (optional)</Label>
                <Input
                  id="trigger_time"
                  type="time"
                  value={editForm.trigger_time}
                  onChange={(e) => setEditForm({ ...editForm, trigger_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Affected Task Forces</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_FORCES.map((tf) => (
                  <Button
                    key={tf}
                    type="button"
                    variant={editForm.affected_task_forces.includes(tf) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleTaskForce(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to target all task forces
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntel?.classification === 'URGENT' && <AlertTriangle className="h-5 w-5 text-red-500" />}
              {selectedIntel?.classification === 'CLASSIFIED' && <Shield className="h-5 w-5 text-amber-500" />}
              {selectedIntel?.classification === 'BRIEFING' && <FileText className="h-5 w-5 text-blue-500" />}
              Intel Preview
            </DialogTitle>
          </DialogHeader>

          {selectedIntel && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                {getClassificationBadge(selectedIntel.classification)}
                <Badge variant="outline">Day {selectedIntel.day}</Badge>
                {selectedIntel.is_released ? (
                  <Badge className="bg-green-500">Released</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold">{selectedIntel.title}</h3>
              </div>

              {selectedIntel.affected_task_forces && selectedIntel.affected_task_forces.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Targeted Task Forces: {selectedIntel.affected_task_forces.join(', ')}
                </div>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Content Preview</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                    {selectedIntel.content}
                  </div>
                </CardContent>
              </Card>

              {selectedIntel.released_at && (
                <p className="text-sm text-muted-foreground">
                  Released: {format(new Date(selectedIntel.released_at), 'PPpp')}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
            {selectedIntel && !selectedIntel.is_released && (
              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={() => {
                  setPreviewDialogOpen(false);
                  handleReleaseClick(selectedIntel);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Release
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
