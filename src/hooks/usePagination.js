import { useEffect, useMemo, useState } from 'react';

/**
 * Shared client-side pagination for data lists.
 *
 * Defaults to 10 rows per page and exposes the standard 10 / 25 / 30
 * page-size control through the shared <Pagination /> component.
 */
export function usePagination(items = [], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  // Changing the page size always returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  return {
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    paginatedItems,
    pagination: {
      currentPage: currentPage,
      totalPages,
      totalItems: items.length,
      pageSize,
      onPageChange: setPage,
      onPageSizeChange: setPageSize,
    },
  };
}

export default usePagination;
