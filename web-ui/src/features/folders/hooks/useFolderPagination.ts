import {
  useQueryParams,
  withDefault,
  NumberParam,
  StringParam,
} from "use-query-params";
import { useRouter } from "next/router";

/**
 * Hook for managing pagination with folder navigation support.
 *
 * Handles:
 * - URL query params for pageIndex, pageSize, and folder path
 * - Folder navigation with automatic pagination reset
 * - Pagination reset while preserving folder context
 *
 * Path handling:
 * - Both prompts and datasets use name-based paths for navigation and display
 * - Backend filters by dataset/prompt name field
 *
 * @example
 * ```tsx
 * const { currentFolderPath, navigateToFolder } = useFolderPagination();
 * navigateToFolder("folder1/folder2"); // Navigate using name-based path
 * ```
 */
export const useFolderPagination = () => {
  const router = useRouter();
  const [queryParams, setQueryParams] = useQueryParams({
    pageIndex: withDefault(NumberParam, 0),
    pageSize: withDefault(NumberParam, 50),
    folder: StringParam,
  });

  const currentFolderPath = queryParams.folder || "";

  /**
   * Navigate to a folder, resetting pagination to page 0
   * @param folderPath - The folder path to navigate to, or undefined for root
   */
  const navigateToFolder = (folderPath: string | undefined) => {
    if (!router.isReady) return;
    setQueryParams({
      folder: folderPath,
      pageIndex: 0, // Reset to first page when changing folders
      pageSize: queryParams.pageSize,
    });
  };

  /**
   * Reset pagination to page 0 while preserving current folder
   * Useful for search/filter changes
   */
  const resetPaginationAndFolder = () => {
    if (!router.isReady) return;
    setQueryParams({
      pageIndex: 0,
      pageSize: queryParams.pageSize,
      folder: queryParams.folder,
    });
  };

  return {
    /**
     * Current folder path from URL query params
     * Empty string if at root
     */
    currentFolderPath,

    /**
     * Pagination state for table component
     */
    paginationState: {
      pageIndex: queryParams.pageIndex,
      pageSize: queryParams.pageSize,
    },

    /**
     * Function to update pagination state
     * Pass to DataTable's pagination.onChange
     */
    setPaginationAndFolderState: (params: Parameters<typeof setQueryParams>[0]) => {
      if (!router.isReady) return;
      setQueryParams(params);
    },

    /**
     * Navigate to a folder with automatic pagination reset
     */
    navigateToFolder,

    /**
     * Reset pagination to page 0 while preserving folder
     */
    resetPaginationAndFolder,
  };
};

export type UseFolderPaginationReturn = ReturnType<typeof useFolderPagination>;
