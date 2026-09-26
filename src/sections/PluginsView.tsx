import {
  Brain,
  FolderOpen,
  Globe,
  ListChecks,
  Monitor,
  PackageCheck,
  Smartphone,
  Terminal,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { PluginStates } from '@/types';
import { PLUGINS, type PluginIcon } from '@/lib/plugins';

const ICONS: Record<PluginIcon, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  monitor: Monitor,
  smartphone: Smartphone,
  wrench: Wrench,
  folder: FolderOpen,
  list: ListChecks,
  brain: Brain,
  terminal: Terminal,
};

interface PluginsViewProps {
  pluginStates: PluginStates;
  setPluginStates: React.Dispatch<React.SetStateAction<PluginStates>>;
}

export default function PluginsView({ pluginStates, setPluginStates }: PluginsViewProps) {
  const toggle = (id: string, enabled: boolean) =>
    setPluginStates((s) => ({ ...s, [id]: { ...s[id], enabled } }));

  const setConfig = (id: string, key: string, value: string) =>
    setPluginStates((s) => ({
      ...s,
      [id]: { ...s[id], config: { ...s[id]?.config, [key]: value } },
    }));

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center gap-3">
          <PackageCheck className="h-5 w-5 text-indigo-400" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">插件中心</h1>
            <p className="text-sm text-zinc-500">
              全部插件已预装并配置好，开关即可控制大模型能否调用
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PLUGINS.map((p) => {
            const state = pluginStates[p.id];
            const Icon = ICONS[p.icon];
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 transition ${
                  state?.enabled
                    ? 'border-zinc-700 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-900/40 opacity-70'
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600/15">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap font-medium text-zinc-100">{p.name}</span>
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 font-mono text-[10px] text-zinc-400"
                      >
                        v{p.version}
                      </Badge>
                      <Badge className="bg-emerald-900/50 text-[10px] text-emerald-300 hover:bg-emerald-900/50">
                        已预装
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{p.tagline}</div>
                  </div>
                  <Switch
                    checked={state?.enabled ?? false}
                    onCheckedChange={(v) => toggle(p.id, v)}
                  />
                </div>

                <p className="mb-3 text-[13px] leading-relaxed text-zinc-400">{p.description}</p>

                <div className="mb-1 flex flex-wrap gap-1.5">
                  {p.tools.map((t) => (
                    <span
                      key={t.name}
                      title={t.description}
                      className="cursor-help rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>

                {state?.enabled && p.configFields?.length ? (
                  <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                    {p.configFields.map((f) => (
                      <div key={f.key}>
                        <Label className="mb-1 block text-xs text-zinc-500">{f.label}</Label>
                        <Input
                          value={state.config[f.key] ?? f.defaultValue ?? ''}
                          placeholder={f.placeholder}
                          onChange={(e) => setConfig(p.id, f.key, e.target.value)}
                          className="h-8 border-zinc-800 bg-zinc-950 font-mono text-xs text-zinc-200"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
