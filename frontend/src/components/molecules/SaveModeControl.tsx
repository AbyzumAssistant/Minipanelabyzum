import { FC } from "react";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";

interface SaveModeControlProps {
  onManualSave: () => Promise<boolean>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  alwaysVisible?: boolean;
}

export const SaveModeControl: FC<SaveModeControlProps> = ({
  onManualSave,
  isSaving,
  hasUnsavedChanges,
  alwaysVisible = true,
}) => {
  const { t } = useLanguage();

  if (!alwaysVisible && !hasUnsavedChanges && !isSaving) {
    return null;
  }

  const handleManualSave = async () => {
    try {
      await onManualSave();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl border border-gray-700/60 bg-gray-900/95 p-3 shadow-2xl backdrop-blur-md animate-fade-in-up">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {isSaving ? (
            <>
              <Save className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
              <span className="font-minecraft text-xs sm:text-sm text-blue-300 truncate">{t("saving")}</span>
            </>
          ) : hasUnsavedChanges ? (
            <>
              <AlertCircle className="h-4 w-4 animate-pulse text-amber-400 shrink-0" />
              <span className="font-minecraft text-xs sm:text-sm text-amber-300 truncate">{t("unsavedChanges")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-minecraft text-xs sm:text-sm text-gray-300 truncate hidden sm:inline">
                {t("saveServerHint")}
              </span>
            </>
          )}
        </div>

        <Button
          type="button"
          onClick={handleManualSave}
          disabled={isSaving}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-minecraft gap-2 transition-all shrink-0"
        >
          <Save className="h-4 w-4" />
          {t("saveServer")}
        </Button>
      </div>
    </div>
  );
};
