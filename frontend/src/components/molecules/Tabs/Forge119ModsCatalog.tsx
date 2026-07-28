'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Plus, Check, Package, AlertTriangle, ChevronDown, Search, X } from 'lucide-react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { mcToast } from '@/lib/utils/minecraft-toast';
import {
  checkModsCompatibility,
  fetchForge119CatalogMeta,
  fetchForge119CategoryMods,
  searchForge119Mods,
  resolveModsWithDependencies,
  saveDeployManifest,
  type CatalogModEntry,
  type CompatibilityWarning,
  type ModSelectionReport,
  type ForgeCatalogCategoryMeta,
} from '@/services/mods/mod-deploy.service';
import { apiRestartServer, getServerStatus } from '@/services/docker/fetchs';
import type { ServerConfig } from '@/lib/types/types';

interface Forge119ModsCatalogProps {
  serverId: string;
  config: ServerConfig;
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void;
}

const PAGE_SIZE = 9;
const FORGE_LABEL = '1.19.2';

export const Forge119ModsCatalog: FC<Forge119ModsCatalogProps> = ({ serverId, config, updateConfig }) => {
  const { t } = useLanguage();
  const [metaLoading, setMetaLoading] = useState(true);
  const [categories, setCategories] = useState<ForgeCatalogCategoryMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState('aventura');
  const [entriesByCategory, setEntriesByCategory] = useState<Record<string, CatalogModEntry[]>>({});
  const [offsetByCategory, setOffsetByCategory] = useState<Record<string, number>>({});
  const [hasMoreByCategory, setHasMoreByCategory] = useState<Record<string, boolean>>({});
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [compatWarnings, setCompatWarnings] = useState<CompatibilityWarning[]>([]);
  const [selectionReport, setSelectionReport] = useState<ModSelectionReport | null>(null);
  const [checkingCompat, setCheckingCompat] = useState(false);
  const compatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogModEntry[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const isSearchMode = debouncedQuery.length >= 2;

  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      setSearchOffset(0);
      setSearchHasMore(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    searchForge119Mods(debouncedQuery, 0, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setSearchResults(page.entries);
        setSearchOffset(page.nextOffset);
        setSearchHasMore(page.hasMore);
      })
      .catch(() => {
        if (!cancelled) mcToast.error(t('forgeCatalogLoadError'));
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isSearchMode, t]);

  const loadMoreSearch = async () => {
    setLoadingMoreSearch(true);
    try {
      const page = await searchForge119Mods(debouncedQuery, searchOffset, PAGE_SIZE);
      setSearchResults((prev) => mergeEntries(prev, page.entries));
      setSearchOffset(page.nextOffset);
      setSearchHasMore(page.hasMore);
    } catch {
      mcToast.error(t('forgeCatalogLoadError'));
    } finally {
      setLoadingMoreSearch(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
  };

  useEffect(() => {
    fetchForge119CatalogMeta()
      .then((meta) => {
        setCategories(meta.categories);
        if (meta.categories.length > 0) {
          setActiveCategory(meta.categories[0].id);
        }
      })
      .catch(() => mcToast.error(t('forgeCatalogLoadError')))
      .finally(() => setMetaLoading(false));
  }, [t]);

  useEffect(() => {
    const fromConfig = (config.modrinthProjects ?? '')
      .split(',')
      .map((entry) => entry.split(':')[0]?.trim())
      .filter(Boolean);
    if (fromConfig.length === 0) return;

    let cancelled = false;
    checkModsCompatibility(fromConfig)
      .then((report) => {
        if (cancelled) return;
        setSelectedSlugs(new Set(report.compatibleSlugs));
        setSelectionReport(report);
        setCompatWarnings(report.warnings);
      })
      .catch(() => {
        if (!cancelled) setSelectedSlugs(new Set(fromConfig));
      });

    return () => {
      cancelled = true;
    };
  }, [config.modrinthProjects]);

  const loadCategoryPage = useCallback(
    async (categoryId: string, offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoadingCategory(categoryId);

      try {
        const page = await fetchForge119CategoryMods(categoryId, offset, PAGE_SIZE);
        setEntriesByCategory((prev) => ({
          ...prev,
          [categoryId]: append
            ? mergeEntries(prev[categoryId] ?? [], page.entries)
            : page.entries,
        }));
        setOffsetByCategory((prev) => ({ ...prev, [categoryId]: page.nextOffset }));
        setHasMoreByCategory((prev) => ({ ...prev, [categoryId]: page.hasMore }));
      } catch {
        mcToast.error(t('forgeCatalogLoadError'));
      } finally {
        setLoadingCategory(null);
        setLoadingMore(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!activeCategory || metaLoading) return;
    if (entriesByCategory[activeCategory]) return;
    loadCategoryPage(activeCategory, 0, false);
  }, [activeCategory, metaLoading, entriesByCategory, loadCategoryPage]);

  useEffect(() => {
    const slugs = Array.from(selectedSlugs);
    if (compatTimer.current) clearTimeout(compatTimer.current);

    if (slugs.length === 0) {
      setCompatWarnings([]);
      setSelectionReport(null);
      return;
    }

    compatTimer.current = setTimeout(async () => {
      setCheckingCompat(true);
      try {
        const result = await checkModsCompatibility(slugs);
        setSelectionReport(result);
        setCompatWarnings(result.warnings);
      } catch {
        setCompatWarnings([]);
        setSelectionReport(null);
      } finally {
        setCheckingCompat(false);
      }
    }, 400);

    return () => {
      if (compatTimer.current) clearTimeout(compatTimer.current);
    };
  }, [selectedSlugs]);

  const activeEntries = entriesByCategory[activeCategory] ?? [];
  const hasMore = hasMoreByCategory[activeCategory] ?? false;
  const categoryLoading = loadingCategory === activeCategory;
  const selectedCount = selectedSlugs.size;

  const toggleMod = (entry: CatalogModEntry) => {
    if (!entry.compatible) {
      mcToast.error(t('forgeCatalogSelectCompatible'));
      return;
    }

    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(entry.slug)) next.delete(entry.slug);
      else next.add(entry.slug);
      return next;
    });
  };

  const loadMore = () => {
    const offset = offsetByCategory[activeCategory] ?? 0;
    loadCategoryPage(activeCategory, offset, true);
  };

  const applySelection = async () => {
    const slugs = Array.from(selectedSlugs);
    if (slugs.length === 0) {
      mcToast.error(t('forgeCatalogSelectOne'));
      return;
    }

    setResolving(true);
    try {
      const report = await checkModsCompatibility(slugs);
      const compatibleSlugs = report.compatibleSlugs;

      if (compatibleSlugs.length === 0) {
        mcToast.error(t('forgeCatalogNoneCompatible'));
        setSelectionReport(report);
        setCompatWarnings(report.warnings);
        return;
      }

      if (report.skipped.length > 0) {
        setSelectedSlugs(new Set(compatibleSlugs));
        setSelectionReport(report);
        setCompatWarnings(report.warnings);
      }

      const resolved = await resolveModsWithDependencies(compatibleSlugs);
      updateConfig('modrinthProjects', resolved.modrinthProjects);
      updateConfig('modrinthLoader', 'forge');
      updateConfig('modrinthDownloadDependencies', 'required');

      await saveDeployManifest(serverId, {
        slugs: resolved.mods.filter((m) => !m.isDependency).map((m) => m.slug),
        lockClientResourcePacks: true,
        requireResourcePack: config.requireResourcePack ?? true,
        resourcePackUrl: config.resourcePackUrl,
        resourcePackSha1: config.resourcePackSha1,
      });

      const { status } = await getServerStatus(serverId);
      if (status === 'running' || status === 'starting') {
        await apiRestartServer(serverId);
      }

      const depCount = resolved.mods.filter((m) => m.isDependency).length;
      const rootCount = resolved.mods.filter((m) => !m.isDependency).length;

      if (report.skipped.length > 0) {
        mcToast.success(
          t('forgeCatalogAppliedPartial')
            .replace('{applied}', String(rootCount))
            .replace('{skipped}', String(report.skipped.length)),
        );
      } else {
        mcToast.success(
          depCount > 0
            ? `${t('forgeCatalogApplied')} (+${depCount} ${t('dependencies')})`
            : t('forgeCatalogApplied'),
        );
      }
    } catch {
      mcToast.error(t('forgeCatalogApplyError'));
    } finally {
      setResolving(false);
    }
  };

  const reasonLabel = useCallback(
    (reason?: CatalogModEntry['reason']) => {
      if (reason === 'not_found') return t('forgeCatalogNotFound');
      if (reason === 'no_forge_119') return t('forgeCatalogIncompatible');
      if (reason === 'client_only') return t('forgeCatalogClientOnly');
      return t('forgeCatalogIncompatible');
    },
    [t],
  );

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
        <span className="text-sm">{t('forgeCatalogLoading')}</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600">
                <Package className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-white">
                {t('forge119CatalogTitle')}
              </h3>
            </div>
            <p className="text-xs text-zinc-400 pl-10">{t('forge119CatalogDesc')}</p>
          </div>

          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <span className="rounded-full bg-sky-600/15 px-3 py-1 text-xs font-medium text-sky-400 ring-1 ring-sky-500/30">
                {selectedCount} seleccionados
              </span>
            )}
            <Button
              type="button"
              size="sm"
              disabled={resolving || selectedCount === 0 || checkingCompat}
              onClick={applySelection}
              className="bg-sky-600 text-white hover:bg-sky-500 border-0 shadow-sm"
            >
              {resolving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t('forgeCatalogDownloadWithDeps')}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('forgeCatalogSearchPlaceholder')}
            className="border-zinc-700 bg-zinc-900 pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 focus-visible:border-sky-500 focus-visible:ring-sky-500/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              aria-label={t('forgeCatalogClearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{t('forgeCatalogSearchHint')}</p>
      </div>

      <div className="p-5 space-y-5">
        {(selectionReport || compatWarnings.length > 0 || checkingCompat) && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 space-y-3">
            <p className="text-xs font-medium text-white flex items-center gap-2">
              {checkingCompat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-sky-400" />
              )}
              {t('forgeCatalogCompatWarning')}
            </p>

            {!checkingCompat && selectionReport && selectionReport.compatibleSlugs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-400 pl-5">
                  {t('forgeCatalogReadyTitle')} ({selectionReport.compatibleSlugs.length})
                </p>
                <p className="text-xs text-zinc-400 pl-5 line-clamp-3">
                  {selectionReport.compatibleSlugs.join(', ')}
                </p>
              </div>
            )}

            {!checkingCompat && selectionReport && selectionReport.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-400 pl-5">
                  {t('forgeCatalogSkippedTitle')} ({selectionReport.skipped.length})
                </p>
                {selectionReport.skipped.map((entry) => (
                  <p key={entry.slug} className="text-xs text-zinc-400 pl-5">
                    {entry.message}
                  </p>
                ))}
              </div>
            )}

            {!checkingCompat &&
              !selectionReport &&
              compatWarnings.map((warning, index) => (
                <p key={`${warning.modA}-${warning.modB ?? index}`} className="text-xs text-zinc-400 pl-5">
                  {warning.message}
                </p>
              ))}
          </div>
        )}

        {isSearchMode ? (
          <div className="space-y-4">
            {searchLoading ? (
              <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                <span className="text-sm">{t('forgeCatalogSearching')}</span>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">{t('forgeCatalogSearchEmpty')}</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((entry) => (
                    <ModCard
                      key={entry.slug}
                      entry={entry}
                      selected={selectedSlugs.has(entry.slug)}
                      reasonLabel={reasonLabel(entry.reason)}
                      onToggle={() => toggleMod(entry)}
                    />
                  ))}
                </div>
                {searchHasMore && (
                  <div className="flex justify-center pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingMoreSearch}
                      onClick={loadMoreSearch}
                      className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-sky-600/50"
                    >
                      {loadingMoreSearch ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      )}
                      {t('forgeCatalogSeeMore')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex h-auto flex-wrap gap-1.5 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors data-[state=active]:border-sky-600 data-[state=active]:bg-sky-600 data-[state=active]:text-white hover:text-white hover:border-zinc-600"
              >
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-5 focus-visible:outline-none">
              <p className="mb-4 text-sm text-zinc-500">{cat.description}</p>

              {categoryLoading && activeEntries.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-16 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                  <span className="text-sm">{t('forgeCatalogLoading')}</span>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(entriesByCategory[cat.id] ?? [])
                      .filter((entry) => entry.compatible)
                      .map((entry) => (
                      <ModCard
                        key={entry.slug}
                        entry={entry}
                        selected={selectedSlugs.has(entry.slug)}
                        reasonLabel={reasonLabel(entry.reason)}
                        onToggle={() => toggleMod(entry)}
                      />
                    ))}
                  </div>

                  {(entriesByCategory[cat.id] ?? []).filter((entry) => entry.compatible).length === 0 &&
                    !categoryLoading && (
                    <p className="py-12 text-center text-sm text-zinc-500">{t('forgeCatalogEmptyCategory')}</p>
                  )}

                  {cat.id === activeCategory && hasMore && (
                    <div className="flex justify-center pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loadingMore}
                        onClick={loadMore}
                        className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-sky-600/50"
                      >
                        {loadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        )}
                        {t('forgeCatalogSeeMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
        )}
      </div>
    </div>
  );
};

function mergeEntries(existing: CatalogModEntry[], incoming: CatalogModEntry[]): CatalogModEntry[] {
  const seen = new Set(existing.map((e) => e.slug));
  return [...existing, ...incoming.filter((e) => !seen.has(e.slug))];
}

function ModCard({
  entry,
  selected,
  reasonLabel,
  onToggle,
}: {
  entry: CatalogModEntry;
  selected: boolean;
  reasonLabel: string;
  onToggle: () => void;
}) {
  const incompatible = !entry.compatible;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={incompatible}
      className={`group flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all ${
        incompatible
          ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-60'
          : selected
            ? 'border-sky-500 bg-sky-950/30 ring-1 ring-sky-500/40'
            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-900/80'
      }`}
    >
      {entry.iconUrl ? (
        <Image
          src={entry.iconUrl}
          alt={entry.name}
          width={44}
          height={44}
          className="rounded-md shrink-0 ring-1 ring-zinc-700"
          unoptimized
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zinc-800 ring-1 ring-zinc-700">
          <Package className="h-5 w-5 text-zinc-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">{entry.name}</span>
          {incompatible ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          ) : selected ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          ) : (
            <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-sky-400" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
          {entry.summary || entry.slug}
        </p>
        <div className="mt-2">
          {incompatible ? (
            <Badge variant="outline" className="border-zinc-700 bg-zinc-950 text-[10px] text-zinc-500">
              {reasonLabel}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-sky-600/40 bg-sky-600/10 text-[10px] text-sky-400">
              Forge {FORGE_LABEL}
              {entry.versionNumber ? ` · v${entry.versionNumber}` : ''}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
