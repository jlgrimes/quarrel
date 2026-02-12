import { useState, useEffect, useCallback } from 'react';
import { analytics } from '../../../lib/analytics';

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
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Input Device
        </label>
        <select
          value={selectedInput}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full rounded bg-bg-tertiary p-2 text-sm text-text-normal outline-none"
        >
          <option value="">Default</option>
          {inputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Input Volume */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Input Volume
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="200"
            value={inputVolume}
            onChange={(e) => setInputVolume(Number(e.target.value))}
            className="flex-1 accent-brand"
          />
          <span className="w-10 text-right text-sm text-text-label">{inputVolume}%</span>
        </div>
      </div>

      {/* Output Device */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Output Device
        </label>
        <select
          value={selectedOutput}
          onChange={(e) => handleOutputChange(e.target.value)}
          className="w-full rounded bg-bg-tertiary p-2 text-sm text-text-normal outline-none"
        >
          <option value="">Default</option>
          {outputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Output Volume */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase text-text-label">
          Output Volume
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="200"
            value={outputVolume}
            onChange={(e) => setOutputVolume(Number(e.target.value))}
            className="flex-1 accent-brand"
          />
          <span className="w-10 text-right text-sm text-text-label">{outputVolume}%</span>
        </div>
      </div>
    </div>
  );
}
