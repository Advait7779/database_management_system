import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from './Icons';

export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-xs text-muted">
        Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()} records
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title="First Page"
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-muted hover:text-primary hover:bg-white/5"
        >
          <ChevronsLeftIcon size={16} />
        </button>

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="Previous Page"
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-muted hover:text-primary hover:bg-white/5"
        >
          <ChevronLeftIcon size={16} />
        </button>

        {page > 3 && (
          <>
            <button onClick={() => onPageChange(1)} className="px-3 py-1 rounded-lg text-xs text-muted hover:bg-white/5 hover:text-primary transition-colors">1</button>
            <span className="text-muted text-xs px-1">...</span>
          </>
        )}

        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded-lg text-xs transition-all font-medium ${p === page
              ? 'text-white'
              : 'text-muted hover:bg-white/5 hover:text-primary'}`}
            style={p === page ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}}>
            {p}
          </button>
        ))}

        {page < totalPages - 2 && (
          <>
            <span className="text-muted text-xs px-1">...</span>
            <button onClick={() => onPageChange(totalPages)} className="px-3 py-1 rounded-lg text-xs text-muted hover:bg-white/5 hover:text-primary transition-colors">{totalPages}</button>
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          title="Next Page"
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-muted hover:text-primary hover:bg-white/5"
        >
          <ChevronRightIcon size={16} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          title="Last Page"
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-muted hover:text-primary hover:bg-white/5"
        >
          <ChevronsRightIcon size={16} />
        </button>
      </div>
    </div>
  );
}
