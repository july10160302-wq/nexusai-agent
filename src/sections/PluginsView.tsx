import { useT } from '@/lib/i18n';
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
const COPY: Record<string, [string, string]> = {
  'browser-use': ['Search · Open · Read', 'Search and read public web pages through an external proxy. Network access and proxy availability are required.'],
  workspace: ['List · Read · Write', 'Access a folder explicitly selected on a supported desktop browser. Connect the desktop service for phone access.'],
  'computer-use': ['Clipboard · Notifications · Downloads', 'Browser device utilities. This does not provide operating-system screen control.'],
  'phone-use': ['Optional Android gateway', 'Connect a separately installed Android gateway. The app does not bundle an accessibility service yet.'],
  'agent-plan': ['Plan · Track progress', 'Keep task steps and completion status alongside the conversation.'],
  memory: ['Preferences across chats', 'Save and recall facts on this device.'],
  'code-runner': ['JavaScript worker sandbox', 'Run JavaScript in a browser worker with a timeout. This is not a desktop terminal.'],
  utilities: ['Time · Calculator', 'Read the current time and evaluate arithmetic expressions.'],
};
const REQUIREMENTS: Record<string, [string, string]> = {
  'phone-use': ['需要另行安装并连接手机网关', 'Separate Android gateway required'],
  workspace: ['需要桌面浏览器文件夹授权；手机请用设备连接', 'Folder permission required; on phones, use Devices'],
  'computer-use': ['受浏览器权限限制；不支持屏幕点击控制', 'Browser permissions required; no screen clicking'],
  'browser-use': ['依赖外部网页代理可用性', 'Requires an available external web proxy'],
};

export default function PluginsView({ pluginStates, setPluginStates }: PluginsViewProps) {
 const t = useT();
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
          <PackageCheck className="h-5 w-5 text-zinc-700" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">{t("插件中心")}</h1>
            <p className="text-sm text-zinc-500">{t("全部插件已预装并配置好，开关即可控制大模型能否调用")}</p>
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
                    ? 'border-zinc-200 bg-zinc-50'
                    : 'border-zinc-200 bg-zinc-50/40 opacity-70'
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900/15">
                    <Icon className="h-5 w-5 text-zinc-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap font-medium text-zinc-900">{t(p.name)}</span>
                      <Badge
                        variant="secondary"
                        className="bg-zinc-100 font-mono text-[10px] text-zinc-600"
                      >
                        v{p.version}
                      </Badge>
                      <Badge className="bg-emerald-50 text-[10px] text-emerald-700 hover:bg-emerald-50">{t("已预装")}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{t(p.tagline, COPY[p.id]?.[0])}</div>
                  </div>
                  <Switch
                    checked={state?.enabled ?? false}
                    onCheckedChange={(v) => toggle(p.id, v)}
                  />
                </div>

                <p className="mb-3 text-[13px] leading-relaxed text-zinc-600">{t(p.description, COPY[p.id]?.[1])}</p>
                <p className="mb-3 text-xs text-amber-700">{t(REQUIREMENTS[p.id]?.[0] || '内置能力', REQUIREMENTS[p.id]?.[1] || 'Built-in capability')}</p>

                <div className="mb-1 flex flex-wrap gap-1.5">
                  {p.tools.map((t) => (
                    <span
                      key={t.name}
                      title={t.description}
                      className="cursor-help rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>

                {state?.enabled && p.configFields?.length ? (
                  <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
                    {p.configFields.map((f) => (
                      <div key={f.key}>
                        <Label className="mb-1 block text-xs text-zinc-500">{f.label}</Label>
                        <Input
                          value={state.config[f.key] ?? f.defaultValue ?? ''}
                          placeholder={f.placeholder}
                          onChange={(e) => setConfig(p.id, f.key, e.target.value)}
                          className="h-8 border-zinc-200 bg-white font-mono text-xs text-zinc-800"
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
