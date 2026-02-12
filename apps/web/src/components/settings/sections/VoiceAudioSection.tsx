import { useState, useEffect, useCallback } from 'react';
import { analytics } from '../../../lib/analytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function VoiceAudioSection() {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);

  const loadDevices = useCallback(async () => {
    try {
      // Request permission to enumerate devices
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        s.getTracks().forEach((t) => t.stop());
      });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
      setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
    } catch {
      // Permission denied or no devices
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleInputChange = (deviceId: string) => {
    setSelectedInput(deviceId);
    analytics.capture('settings:voice_input_changed');
  };

  const handleOutputChange = (deviceId: string) => {
    setSelectedOutput(deviceId);
    analytics.capture('settings:voice_output_changed');
  };

  return (
    <div>
      <h1 className="mb-5 text-xl font-bold text-white">Voice & Audio</h1>

      {/* Input Device */}
      <Card className='mb-6 border-white/10 bg-bg-tertiary/65 py-0'>
        <CardHeader>
          <CardTitle className='text-sm uppercase tracking-wide text-text-label'>Input</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6 pb-5'>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Input Device
        </label>
        <Select value={selectedInput || 'default'} onValueChange={(value) => handleInputChange(value === 'default' ? '' : value)}>
          <SelectTrigger className="w-full border-none bg-bg-tertiary text-sm text-text-normal">
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent className="bg-bg-secondary border-bg-tertiary text-text-normal">
            <SelectItem value="default">Default</SelectItem>
            {inputDevices.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Input Volume */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Input Volume
        </label>
        <div className="flex items-center gap-3">
          <Slider
            min={0}
            max={200}
            step={1}
            value={[inputVolume]}
            onValueChange={(value) => setInputVolume(value[0] ?? 0)}
            className="flex-1"
          />
          <span className="w-10 text-right text-sm text-text-label">{inputVolume}%</span>
        </div>
      </div>
        </CardContent>
      </Card>

      {/* Output Device */}
      <Card className='mb-6 border-white/10 bg-bg-tertiary/65 py-0'>
        <CardHeader>
          <CardTitle className='text-sm uppercase tracking-wide text-text-label'>Output</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6 pb-5'>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Output Device
        </label>
        <Select value={selectedOutput || 'default'} onValueChange={(value) => handleOutputChange(value === 'default' ? '' : value)}>
          <SelectTrigger className="w-full border-none bg-bg-tertiary text-sm text-text-normal">
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent className="bg-bg-secondary border-bg-tertiary text-text-normal">
            <SelectItem value="default">Default</SelectItem>
            {outputDevices.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Volume */}
      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Output Volume
        </label>
        <div className="flex items-center gap-3">
          <Slider
            min={0}
            max={200}
            step={1}
            value={[outputVolume]}
            onValueChange={(value) => setOutputVolume(value[0] ?? 0)}
            className="flex-1"
          />
          <span className="w-10 text-right text-sm text-text-label">{outputVolume}%</span>
        </div>
      </div>
        </CardContent>
      </Card>
    </div>
  );
}
