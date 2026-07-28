'use client';

import { FC, useCallback, useEffect, useState, DragEvent } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Package,
  ChevronDown,
  AlertTriangle,
  X,
  GripVertical,
  Hammer,
  Download,
} from 'lucide-react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { mcToast } from '@/lib/utils/minecraft-toast';
import {
  fetchPaperCatalogMeta,
  fetchPaperCategoryPlugins,
  resolvePluginsWithDependencies,
  buildPluginPack,
  savePluginManifest,
  type CatalogPluginEntry,
  type PaperCatalogCategoryMeta,
} from '@/services/plugins/plugin-builder.service';
import type { ServerConfig } from '@/lib/types/types';

interface PaperPluginBuilderTabProps {
  serverId: string;
  config: ServerConfig;
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void;
}

const PAGE_SIZE = 9;
const DRAG_TYPE = 'application/x-paper-plugin';

export const PaperPluginBuilderTab: FC<PaperPluginBuilderTabProps> = ({
  serverId,
  config,
  updateConfig,
}) => {
  const { t } = useLanguage();
  const gameVersion = config.minecraftVersion || '1.21.1';

  const [metaLoading, setMetaLoading] = useState(true);
  const [categories, setCategories] = useState<PaperCatalogCategoryMeta[]>([]);
  const [activeCategory, setActiveCategory] = useState('esenciales');
  const [entriesByCategory, setEntriesByCategory] = useState<Record<string, CatalogPluginEntry[]>>({});
  const [offsetByCategory, setOffsetByCategory] = useState<Record<string, number>>({});
  const [hasMoreByCategory, setHasMoreByCategory] = useState<Record<string, boolean>>({});
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [building, setBuilding] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Map<string, CatalogPluginEntry>>(new Map());
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchPaperCatalogMeta()
      .then((meta) => {
        setCategories(meta.categories);
        if (meta.categories.length > 0) {
          setActiveCategory(meta.categories[0].id);
        }
      })
      .catch(() => mcToast.error(t('paperMcCatalogLoadError')))
      .finally(() => setMetaLoading(false));
  }, [t]);

  useEffect(() => {
    const fromConfig = (config.modrinthProjects ?? '')
      .split(',')
      .map((entry) => entry.split(':')[0]?.trim())
      .filter(Boolean);
    if (fromConfig.length > 0) {
      setSelectedSlugs(new Set(fromConfig));
    }
  }, [config.modrinthProjects]);

  const loadCategoryPage = useCallback(
    async (categoryId: string, offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoadingCategory(categoryId);

      try {
        const page = await fetchPaperCategoryPlugins(categoryId, gameVersion, offset, PAGE_SIZE);
        setEntriesByCategory((prev) => ({
          ...prev,
          [categoryId]: append
            ? mergeEntries(prev[categoryId] ?? [], page.entries)
            : page.entries,
        }));
        setOffsetByCategory((prev) => ({ ...prev, [categoryId]: page.nextOffset }));
        setHasMoreByCategory((prev) => ({ ...prev, [categoryId]: page.hasMore }));
      } catch {
        mcToast.error(t('paperMcCatalogLoadError'));
      } finally {
        setLoadingCategory(null);
        setLoadingMore(false);
      }
    },
    [gameVersion, t],
  );

  useEffect(() => {
    if (!activeCategory || metaLoading) return;
    if (entriesByCategory[activeCategory]) return;
    loadCategoryPage(activeCategory, 0, false);
  }, [activeCategory, metaLoading, entriesByCategory, loadCategoryPage]);

  const addPlugin = (entry: CatalogPluginEntry) => {
    if (!entry.compatible) {
      mcToast.error(t('paperMcIncompatible'));
      return;
    }
    setSelectedSlugs((prev) => new Set(prev).add(entry.slug));
    setSelectedEntries((prev) => new Map(prev).set(entry.slug, entry));
    mcToast.success(t('paperMcPluginAdded'));
  };

  const removePlugin = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
  };

  const handleDragStart = (e: DragEvent, entry: CatalogPluginEntry) => {
    if (!entry.compatible) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(entry));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    try {
      const entry = JSON.parse(raw) as CatalogPluginEntry;
      addPlugin(entry);
    } catch {
      /* ignore invalid drag data */
    }
  };

  const handleMakePlugin = async () => {
    const slugs = Array.from(selectedSlugs);
    if (slugs.length === 0) {
      mcToast.error(t('paperMcSelectOne'));
      return;
    }

    setBuilding(true);
    try {
      const resolved = await resolvePluginsWithDependencies(slugs, gameVersion);
      updateConfig('modrinthProjects', resolved.modrinthProjects);

      await savePluginManifest(serverId, { slugs, gameVersion });

      const blob = await buildPluginPack(slugs, gameVersion);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paper-plugins-${gameVersion}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const depCount = resolved.plugins.filter((p) => p.isDependency).length;
      mcToast.success(
        depCount > 0
          ? `${t('paperMcBuildSuccess')} (+${depCount} ${t('dependencies')})`
          : t('paperMcBuildSuccess'),
      );
    } catch {
      mcToast.error(t('paperMcBuildError'));
    } finally {
      setBuilding(false);
    }
  };

  const reasonLabel = (reason?: CatalogPluginEntry['reason']) => {
    if (reason === 'not_found') return t('forgeCatalogNotFound');
    if (reason === 'no_mc_version') return t('paperMcIncompatible');
    return t('paperMcIncompatible');
  };

  const activeEntries = entriesByCategory[activeCategory] ?? [];
  const hasMore = hasMoreByCategory[activeCategory] ?? false;
  const categoryLoading = loadingCategory === activeCategory;
  const selectedList = Array.from(selectedSlugs).map(
    (slug) => selectedEntries.get(slug) ?? { slug, name: slug, summary: '', compatible: true },
  );

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        <span className="text-sm">{t('paperMcCatalogLoading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                  <Image src="/images/paper.webp" alt="PaperMC" width={20} height={20} unoptimized />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-white">
                  {t('paperMcBuilderTitle')}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 pl-10">{t('paperMcBuilderDesc')}</p>
            </div>
            <Badge variant="outline" className="border-emerald-600/40 bg-emerald-600/10 text-emerald-400">
              MC {gameVersion}
            </Badge>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
          {/* Catálogo */}
          <div className="border-b lg:border-b-0 lg:border-r border-zinc-800 p-5 space-y-5">
            <p className="text-xs text-zinc-500">{t('paperMcDragHint')}</p>

            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="flex h-auto flex-wrap gap-1.5 bg-transparent p-0">
                {categories.map((cat) => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white hover:text-white hover:border-zinc-600"
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
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                      <span className="text-sm">{t('paperMcCatalogLoading')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(entriesByCategory[cat.id] ?? []).map((entry) => (
                          <PluginCard
                            key={entry.slug}
                            entry={entry}
                            selected={selectedSlugs.has(entry.slug)}
                            reasonLabel={reasonLabel(entry.reason)}
                            gameVersion={gameVersion}
                            onAdd={() => addPlugin(entry)}
                            onDragStart={(e) => handleDragStart(e, entry)}
                          />
                        ))}
                      </div>

                      {(entriesByCategory[cat.id] ?? []).length === 0 && !categoryLoading && (
                        <p className="py-12 text-center text-sm text-zinc-500">
                          {t('paperMcEmptyCategory')}
                        </p>
                      )}

                      {cat.id === activeCategory && hasMore && (
                        <div className="flex justify-center pt-6">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loadingMore}
                            onClick={() =>
                              loadCategoryPage(activeCategory, offsetByCategory[activeCategory] ?? 0, true)
                            }
                            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-emerald-600/50"
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
          </div>

          {/* Zona de drop + hacer plugin */}
          <div className="p-5 flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">{t('paperMcDropZone')}</h4>
              <p className="text-xs text-zinc-500">{t('paperMcDropZoneHint')}</p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex-1 min-h-[280px] rounded-xl border-2 border-dashed p-4 transition-colors ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-950/30'
                  : 'border-zinc-700 bg-zinc-900/50'
              }`}
            >
              {selectedList.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-8">
                  <Download className="h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-500">{t('paperMcDropZoneEmpty')}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {selectedList.map((entry) => (
                    <li
                      key={entry.slug}
                      className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" />
                      {entry.iconUrl ? (
                        <Image
                          src={entry.iconUrl}
                          alt={entry.name}
                          width={28}
                          height={28}
                          className="rounded shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-zinc-800">
                          <Package className="h-3.5 w-3.5 text-zinc-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">{entry.name}</p>
                        {entry.versionNumber && (
                          <p className="text-[10px] text-zinc-500">v{entry.versionNumber}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlugin(entry.slug)}
                        className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                        aria-label={t('paperMcRemove')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {selectedSlugs.size > 0 && (
                <span className="text-xs text-emerald-400">
                  {selectedSlugs.size} {t('paperMcSelectedCount')}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={building || selectedSlugs.size === 0}
                onClick={handleMakePlugin}
                className="ml-auto bg-emerald-600 text-white hover:bg-emerald-500 border-0 shadow-sm"
              >
                {building ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Hammer className="h-4 w-4 mr-2" />
                )}
                {building ? t('paperMcBuilding') : t('paperMcMakePlugin')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function mergeEntries(
  existing: CatalogPluginEntry[],
  incoming: CatalogPluginEntry[],
): CatalogPluginEntry[] {
  const seen = new Set(existing.map((e) => e.slug));
  return [...existing, ...incoming.filter((e) => !seen.has(e.slug))];
}

function PluginCard({
  entry,
  selected,
  reasonLabel,
  gameVersion,
  onAdd,
  onDragStart,
}: {
  entry: CatalogPluginEntry;
  selected: boolean;
  reasonLabel: string;
  gameVersion: string;
  onAdd: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const incompatible = !entry.compatible;

  return (
    <div
      draggable={!incompatible}
      onDragStart={onDragStart}
      onClick={() => !incompatible && onAdd()}
      role="button"
      tabIndex={incompatible ? -1 : 0}
      onKeyDown={(e) => {
        if (!incompatible && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onAdd();
        }
      }}
      className={`group flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all cursor-grab active:cursor-grabbing ${
        incompatible
          ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-60'
          : selected
            ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/40'
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
          {incompatible && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
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
            <Badge
              variant="outline"
              className="border-emerald-600/40 bg-emerald-600/10 text-[10px] text-emerald-400"
            >
              Paper {gameVersion}
              {entry.versionNumber ? ` · v${entry.versionNumber}` : ''}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
