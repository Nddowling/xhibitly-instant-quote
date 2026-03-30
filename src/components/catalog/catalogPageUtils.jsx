export const HIDDEN_CATALOG_PAGES = [1, 2, 3, 4, 5, 6];
export const FIRST_VISIBLE_CATALOG_PAGE = 0;

export function normalizeCatalogPage(requestedPage, currentPage, maxPage) {
  let page = Number.isFinite(requestedPage) ? requestedPage : FIRST_VISIBLE_CATALOG_PAGE;
  page = Math.max(FIRST_VISIBLE_CATALOG_PAGE, Math.min(page, maxPage));

  if (currentPage === 0 && page > 0 && page < 7) page = 7;
  if (currentPage >= 7 && page > 0 && page < 7) page = 0;

  return page;
}