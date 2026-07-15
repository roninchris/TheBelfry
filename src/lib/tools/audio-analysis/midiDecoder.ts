/**
 * Standard MIDI File (.mid) binary parser.
 * Extracts header metadata (format, tracks count, division/timing) and walks MTrk track events
 * to parse note triggers, channel messages, tempo events, and text/meta cues.
 */

export interface MidiHeader {
  format: number;
  numTracks: number;
  division: number;
}

export interface MidiEvent {
  deltaTime: number;
  absoluteTime: number;
  type: string;
  channel?: number;
  param1?: number; // e.g. note number, control number
  param2?: number; // e.g. velocity, value
  text?: string;   // e.g. track name, lyrics, tempo value
  trackIndex: number;
}

export interface ParsedMidi {
  header: MidiHeader;
  events: MidiEvent[];
  warnings: string[];
}

// Reads Variable Length Quantity (VLQ) from DataView at offset
function readVLQ(view: DataView, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;
  while (true) {
    if (offset + bytesRead >= view.byteLength) {
      throw new Error("Unexpected EOF reading Variable Length Quantity");
    }
    const byte = view.getUint8(offset + bytesRead);
    bytesRead++;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      break;
    }
  }
  return { value, bytesRead };
}

export function parseMidiFile(buffer: ArrayBuffer): ParsedMidi {
  const view = new DataView(buffer);
  const events: MidiEvent[] = [];
  const warnings: string[] = [];

  if (buffer.byteLength < 14) {
    throw new Error("File is too small to be a valid MIDI file (minimum 14 bytes required)");
  }

  // 1. Verify Header Chunk Type "MThd"
  const mthd = view.getUint32(0, false);
  if (mthd !== 0x4D546864) { // "MThd"
    throw new Error("Invalid MIDI header signature: expected 'MThd' (0x4D546864)");
  }

  const headerLength = view.getUint32(4, false);
  if (headerLength < 6) {
    throw new Error(`Invalid MIDI header length: expected at least 6 bytes, got ${headerLength}`);
  }

  const format = view.getUint16(8, false);
  const numTracks = view.getUint16(10, false);
  const division = view.getUint16(12, false);

  const header: MidiHeader = { format, numTracks, division };

  let offset = 8 + headerLength;

  // Track loop
  for (let trackIdx = 0; trackIdx < numTracks; trackIdx++) {
    if (offset >= view.byteLength) {
      warnings.push(`Expected track ${trackIdx + 1} but reached end of file`);
      break;
    }

    // Verify Track Chunk Type "MTrk"
    const mtrk = view.getUint32(offset, false);
    if (mtrk !== 0x4D54726B) { // "MTrk"
      warnings.push(`Expected track chunk signature 'MTrk' at offset ${offset}, but found 0x${mtrk.toString(16)}`);
      // Find the next MTrk signature to recover if possible, or break
      let foundNext = false;
      for (let i = offset + 1; i < view.byteLength - 4; i++) {
        if (view.getUint32(i, false) === 0x4D54726B) {
          offset = i;
          foundNext = true;
          break;
        }
      }
      if (!foundNext) break;
    }

    const trackLength = view.getUint32(offset + 4, false);
    const trackEnd = offset + 8 + trackLength;
    let trackOffset = offset + 8;
    let absoluteTime = 0;
    let runningStatus = 0;

    while (trackOffset < trackEnd && trackOffset < view.byteLength) {
      // Read Delta Time
      const dtResult = readVLQ(view, trackOffset);
      const deltaTime = dtResult.value;
      trackOffset += dtResult.bytesRead;
      absoluteTime += deltaTime;

      if (trackOffset >= view.byteLength) {
        warnings.push(`Unexpected end of track ${trackIdx + 1} while reading event status`);
        break;
      }

      let statusByte = view.getUint8(trackOffset);
      
      // Handle running status
      if ((statusByte & 0x80) === 0) {
        if (runningStatus === 0) {
          warnings.push(`Missing status byte in track ${trackIdx + 1} at offset ${trackOffset}`);
          trackOffset++;
          continue;
        }
        statusByte = runningStatus;
      } else {
        trackOffset++;
        if (statusByte < 0xF0) {
          runningStatus = statusByte;
        }
      }

      const highNibble = statusByte & 0xF0;
      const channel = statusByte & 0x0F;

      if (highNibble >= 0x80 && highNibble < 0xF0) {
        // Voice message
        switch (highNibble) {
          case 0x80: { // Note Off
            const note = view.getUint8(trackOffset++);
            const velocity = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: "Note Off",
              channel,
              param1: note,
              param2: velocity,
              trackIndex: trackIdx
            });
            break;
          }
          case 0x90: { // Note On
            const note = view.getUint8(trackOffset++);
            const velocity = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: velocity === 0 ? "Note Off" : "Note On",
              channel,
              param1: note,
              param2: velocity,
              trackIndex: trackIdx
            });
            break;
          }
          case 0xA0: { // Key Pressure / Polyphonic Aftertouch
            const note = view.getUint8(trackOffset++);
            const pressure = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: "Polyphonic Aftertouch",
              channel,
              param1: note,
              param2: pressure,
              trackIndex: trackIdx
            });
            break;
          }
          case 0xB0: { // Control Change
            const controller = view.getUint8(trackOffset++);
            const value = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: "Control Change",
              channel,
              param1: controller,
              param2: value,
              trackIndex: trackIdx
            });
            break;
          }
          case 0xC0: { // Program Change
            const program = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: "Program Change",
              channel,
              param1: program,
              trackIndex: trackIdx
            });
            break;
          }
          case 0xD0: { // Channel Pressure / Aftertouch
            const pressure = view.getUint8(trackOffset++);
            events.push({
              deltaTime,
              absoluteTime,
              type: "Channel Pressure",
              channel,
              param1: pressure,
              trackIndex: trackIdx
            });
            break;
          }
          case 0xE0: { // Pitch Bend
            const lsb = view.getUint8(trackOffset++);
            const msb = view.getUint8(trackOffset++);
            const bend = (msb << 7) | lsb;
            events.push({
              deltaTime,
              absoluteTime,
              type: "Pitch Bend",
              channel,
              param1: bend,
              trackIndex: trackIdx
            });
            break;
          }
        }
      } else if (statusByte === 0xFF) {
        // Meta Event
        const metaType = view.getUint8(trackOffset++);
        const lenResult = readVLQ(view, trackOffset);
        const metaLen = lenResult.value;
        trackOffset += lenResult.bytesRead;

        const dataBytes = new Uint8Array(buffer, trackOffset, metaLen);
        trackOffset += metaLen;

        let textValue = "";
        try {
          textValue = new TextDecoder("utf-8", { fatal: false }).decode(dataBytes);
        } catch {
          textValue = Array.from(dataBytes).map(b => b.toString(16).padStart(2, "0")).join(" ");
        }

        switch (metaType) {
          case 0x01: // Text Event
            events.push({ deltaTime, absoluteTime, type: "Text Event", text: textValue, trackIndex: trackIdx });
            break;
          case 0x02: // Copyright Notice
            events.push({ deltaTime, absoluteTime, type: "Copyright Notice", text: textValue, trackIndex: trackIdx });
            break;
          case 0x03: // Sequence/Track Name
            events.push({ deltaTime, absoluteTime, type: "Track Name", text: textValue, trackIndex: trackIdx });
            break;
          case 0x04: // Instrument Name
            events.push({ deltaTime, absoluteTime, type: "Instrument Name", text: textValue, trackIndex: trackIdx });
            break;
          case 0x05: // Lyric
            events.push({ deltaTime, absoluteTime, type: "Lyric", text: textValue, trackIndex: trackIdx });
            break;
          case 0x06: // Marker
            events.push({ deltaTime, absoluteTime, type: "Marker", text: textValue, trackIndex: trackIdx });
            break;
          case 0x07: // Cue Point
            events.push({ deltaTime, absoluteTime, type: "Cue Point", text: textValue, trackIndex: trackIdx });
            break;
          case 0x51: { // Tempo
            if (metaLen >= 3) {
              const microsecondsPerBeat = (dataBytes[0] << 16) | (dataBytes[1] << 8) | dataBytes[2];
              const bpm = Math.round(60000000 / microsecondsPerBeat);
              events.push({
                deltaTime,
                absoluteTime,
                type: "Tempo Change",
                text: `${bpm} BPM`,
                param1: bpm,
                trackIndex: trackIdx
              });
            }
            break;
          }
          case 0x58: { // Time Signature
            if (metaLen >= 2) {
              const numerator = dataBytes[0];
              const denominator = Math.pow(2, dataBytes[1]);
              events.push({
                deltaTime,
                absoluteTime,
                type: "Time Signature",
                text: `${numerator}/${denominator}`,
                trackIndex: trackIdx
              });
            }
            break;
          }
          case 0x59: { // Key Signature
            if (metaLen >= 2) {
              const sf = dataBytes[0]; // sharps/flats
              const mi = dataBytes[1]; // major/minor
              events.push({
                deltaTime,
                absoluteTime,
                type: "Key Signature",
                text: `${sf} ${mi === 0 ? "Major" : "Minor"}`,
                trackIndex: trackIdx
              });
            }
            break;
          }
          case 0x2F: // End of Track
            events.push({ deltaTime, absoluteTime, type: "End of Track", trackIndex: trackIdx });
            break;
          default:
            events.push({
              deltaTime,
              absoluteTime,
              type: `Meta Event (0x${metaType.toString(16).toUpperCase()})`,
              text: textValue,
              trackIndex: trackIdx
            });
        }
      } else if (statusByte === 0xF0 || statusByte === 0xF7) {
        // Sysex Event
        const lenResult = readVLQ(view, trackOffset);
        const sysexLen = lenResult.value;
        trackOffset += lenResult.bytesRead;
        trackOffset += sysexLen; // skip bytes
        events.push({
          deltaTime,
          absoluteTime,
          type: "System Exclusive",
          trackIndex: trackIdx
        });
      } else {
        // Unknown status byte
        warnings.push(`Unknown status byte 0x${statusByte.toString(16)} at offset ${trackOffset - 1}`);
        trackOffset++;
      }
    }

    offset = trackEnd;
  }

  return { header, events, warnings };
}

// Convert MIDI note numbers to standard scientific pitch notations
export function noteNumberToName(note: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(note / 12) - 1;
  const noteName = notes[note % 12];
  return `${noteName}${octave}`;
}
