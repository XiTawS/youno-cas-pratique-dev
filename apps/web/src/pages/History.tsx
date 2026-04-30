import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { AnalysisListItem } from '@youno/shared/schemas/analyze';
import type { AnalysisStatus } from '@youno/shared/schemas/signals';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Loader2,
  Search,
  Sparkles,
  Sprout,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchHistory } from '@/lib/api';

// Page Historique - data table avec tri, recherche et pagination.
// 50 items max côté API, donc tri + filtrage côté client suffisent.
export function History() {
  const { getToken } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchHistory(token);
    },
  });

  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<AnalysisListItem>[]>(
    () => [
      {
        accessorKey: 'domain',
        header: ({ column }) => (
          <SortHeader
            label="Domaine"
            sortDirection={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.domain}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortHeader
            label="Date"
            sortDirection={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {new Date(row.original.createdAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'pipelineStatus',
        header: 'Pipeline',
        enableSorting: false,
        cell: ({ row }) => <PipelineBadge status={row.original.pipelineStatus} />,
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status ? (
            <StatusCell status={row.original.status} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'action',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const isClickable =
            row.original.pipelineStatus === 'success' && row.original.status !== null;
          if (!isClickable) {
            return (
              <span
                className="text-xs text-muted-foreground"
                title={row.original.errorMessage ?? ''}
              >
                {row.original.pipelineStatus === 'error' ? 'voir erreur' : '…'}
              </span>
            );
          }
          return (
            <Link
              to={`/analysis/${row.original.id}`}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Voir →
            </Link>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Historique</h1>
        <p className="text-sm text-muted-foreground">
          Toutes tes analyses, triables et filtrables. Maximum 50 retournées par l'API.
        </p>
      </header>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher par domaine…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <Card>
          <div className="p-6 text-sm text-destructive">
            {(error as Error | undefined)?.message ?? 'Erreur inconnue'}
          </div>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-[var(--color-border)]">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      {globalFilter
                        ? `Aucun résultat pour "${globalFilter}"`
                        : "Pas encore d'analyse — lance la première depuis la sidebar."}
                    </td>
                  </tr>
                )}
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()} ·{' '}
                {table.getFilteredRowModel().rows.length} résultats
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  sortDirection: false | 'asc' | 'desc';
  onClick: () => void;
}

function SortHeader({ label, sortDirection, onClick }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {sortDirection === false && <ArrowUpDown className="h-3 w-3 opacity-60" />}
      {sortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
      {sortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
    </button>
  );
}

function PipelineBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  if (status === 'success') return <Badge variant="success">terminée</Badge>;
  if (status === 'error') return <Badge variant="destructive">erreur</Badge>;
  return <Badge variant="outline">en cours</Badge>;
}

const STATUS_DISPLAY: Record<AnalysisStatus, { label: string; icon: ReactNode; cls: string }> = {
  too_early: {
    label: 'Trop tôt',
    icon: <Sprout className="h-3.5 w-3.5" />,
    cls: 'text-muted-foreground',
  },
  to_watch: {
    label: 'À surveiller',
    icon: <Eye className="h-3.5 w-3.5" />,
    cls: 'text-amber-700',
  },
  good_timing: {
    label: 'Bon timing',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    cls: 'text-blue-700',
  },
  mature: {
    label: 'Prospect mature',
    icon: <Flame className="h-3.5 w-3.5" />,
    cls: 'text-emerald-700',
  },
};

function StatusCell({ status }: { status: AnalysisStatus }) {
  const cfg = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
