"""Fileo promo: the score and sound design, composed in code (no samples).

"Lagos": an Afro-pop groove at 120 BPM (one beat = 0.5 s), built around the
story in script.json. Every landing of the green ball plays the next note of
the splash's tap melody, so the ball has a voice. Original work: see
LICENSE-audio.txt.

Usage: python3 compose-audio.py script.json OUT.wav
Needs numpy and scipy. make-promo.mjs then masters OUT.wav to -14 LUFS.
"""
import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 35.5
N = int(SR * DUR)
B = 0.5  # one beat
rng = np.random.default_rng(5)
TAP_RNG = np.random.default_rng(11)


# ─── Building blocks ─────────────────────────────────────────────────────────
def note(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + names[n]
    return 440.0 * 2 ** ((midi - 69) / 12)


def env_adsr(n, a, d, s, r, sustain_len):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, int(sustain_len * SR) - a_n - d_n)
    e = np.concatenate([
        np.linspace(0, 1, max(a_n, 1)) ** 2,
        np.linspace(1, s, max(d_n, 1)),
        np.full(s_n, s),
        np.linspace(s, 0, max(r_n, 1)) ** 1.5,
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), 'low', output='sos')
    return sosfilt(sos, x, axis=0)


def hp(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), 'high', output='sos')
    return sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band', output='sos')
    return sosfilt(sos, x, axis=0)


def sweep_filter(x, f0, f1, kind='low', block=512):
    """Time-varying filter, block-wise with carried state (exponential sweep)."""
    if x.ndim == 2:
        return np.stack([sweep_filter(x[:, c], f0, f1, kind, block) for c in range(x.shape[1])], 1)
    y = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(nb - 1, 1))
        if kind == 'band':
            sos = butter(2, [max(f * 0.7, 20) / (SR / 2), min(f * 1.4, SR / 2 - 100) / (SR / 2)], 'band', output='sos')
        else:
            sos = butter(2, min(f, SR / 2 - 100) / (SR / 2), kind, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        y[b * block:(b + 1) * block], zi = sosfilt(sos, seg, zi=zi)
    return y


def reverb_ir(seconds=2.8, damp=5000, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    decay = np.exp(-6.9 * tt / seconds)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], 1) * decay[:, None]
    ir = lp(ir, damp)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0))


def reverb(x, ir, wet=0.3):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


def pad_voice(freq, length, bright=0.5, detune=0.12, attack=1.2, release=2.0, seed=0):
    """Soft additive saw-ish pad with three detuned voices."""
    n = int((length + release) * SR)
    tt = np.arange(n) / SR
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    nh = 10
    for v, (cents, pan) in enumerate([(-detune * 100, -0.6), (0, 0), (detune * 100, 0.6)]):
        f = freq * 2 ** (cents / 1200)
        vib = 1 + 0.0015 * np.sin(2 * np.pi * (0.2 + 0.07 * v) * tt + r.random() * 6)
        s = np.zeros(n)
        for h in range(1, nh + 1):
            if f * h > 9000:
                break
            s += np.sin(2 * np.pi * f * h * tt * vib + r.random() * 6) / h ** (1.9 - bright)
        l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        out[:, 0] += s * l
        out[:, 1] += s * rr
    out *= env_adsr(n, attack, 0.5, 0.85, release, length)[:, None]
    return out / 6


def pluck(freq, decay=0.6, bright=0.6, seed=0):
    n = int((decay * 4) * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for h, a in enumerate([1, 0.5 * bright, 0.25 * bright, 0.12 * bright, 0.06 * bright], 1):
        s += a * np.sin(2 * np.pi * freq * h * tt) * np.exp(-tt * (h * 1.2) / decay)
    s *= np.exp(-tt / decay)
    att = int(0.004 * SR)
    s[:att] *= np.linspace(0, 1, att)
    return s * 0.4


def bell(freq, decay=3.2):
    n = int(decay * 2 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dk in [(1, 1, 1), (2.0, 0.35, 1.4), (2.76, 0.25, 1.8), (5.4, 0.12, 3.5), (8.93, 0.05, 6)]:
        s += amp * np.sin(2 * np.pi * freq * ratio * tt) * np.exp(-tt * dk / decay * 2.2)
    att = int(0.002 * SR)
    s[:att] *= np.linspace(0, 1, att)
    return s * 0.3


def tick(seed):
    r = np.random.default_rng(seed)
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    click = bp(r.standard_normal(n), 3500, 7500) * np.exp(-tt * 260) * 0.5
    blip = np.sin(2 * np.pi * (2100 + r.random() * 500) * tt) * np.exp(-tt * 90) * 0.35
    return click + blip


def tap(freq):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 18)
    wood = bp(TAP_RNG.standard_normal(n), 900, 2400) * np.exp(-tt * 160) * 0.5
    return (body + wood) * 0.5


def whoosh(length, f0, f1, seed=5):
    n = int(length * SR)
    noise = np.random.default_rng(seed).standard_normal(n)
    y = sweep_filter(noise, f0, f1, 'band')
    shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.6
    return y * shape


def write(path, x):
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x / peak * 0.98
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


def buf():
    return np.zeros((N, 2))


def place(out, sig, at, pan=0.0, gain=1.0):
    i = int(round(at * SR))
    if i >= N or i < 0:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1)
    n = min(len(sig), N - i)
    out[i:i + n] += sig[:n] * gain


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def kick(punch=1.0):
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 400) * 0.25 * punch
    return np.tanh((s + click) * 1.6) * 0.8


def clap():
    t = tt(0.35)
    n = rng.standard_normal(len(t))
    env = np.zeros(len(t))
    for d in (0, 0.011, 0.022):
        k = int(d * SR)
        env[k:] += np.exp(-(t[: len(t) - k]) * 90)
    env += np.exp(-t * 14) * 0.35
    return bp(n, 900, 5000) * env * 0.45


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 70)) * 0.22


def shaker(accent=1.0):
    t = tt(0.08)
    env = np.sin(np.pi * np.clip(t / 0.06, 0, 1)) ** 2
    return bp(rng.standard_normal(len(t)), 5000, 11000) * env * 0.16 * accent


def rim():
    t = tt(0.12)
    return (np.sin(2 * np.pi * 1750 * t) * np.exp(-t * 60) * 0.5 + bp(rng.standard_normal(len(t)), 1500, 4000) * np.exp(-t * 200) * 0.4) * 0.5


def snare_roll(start, end, out, gain=0.3):
    t, step = start, 0.125
    while t < end:
        k = (t - start) / (end - start)
        place(out, clap() * (0.3 + 0.7 * k), t, pan=rng.uniform(-0.2, 0.2), gain=gain)
        t += step * (1 - 0.5 * k)


def log_drum(freq, length=0.4):
    t = tt(length + 0.1)
    f = freq * (1 + 0.35 * np.exp(-t * 40))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = np.tanh(s * 2.2) * np.exp(-t * 5.5)
    return lp(s, 900) * 0.6


def sub(freq, length):
    t = tt(length)
    s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    env = np.minimum(1, t / 0.01) * np.minimum(1, (length - t) / 0.03)
    return s * env * 0.45


def marimba(freq):
    t = tt(0.6)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 7) + 0.35 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 22)
    att = int(0.002 * SR)
    s[:att] *= np.linspace(0, 1, att)
    return s * 0.35


def stab(notes, length=0.3, bright=0.6):
    out = None
    for nm in notes:
        v = pad_voice(note(nm), length, bright=bright, attack=0.005, release=0.12, seed=hash(nm) % 100)
        out = v if out is None else out + v
    return lp(out, 6000)


def ding(f1, f2):
    t = tt(0.7)
    s = np.sin(2 * np.pi * f1 * t) * np.exp(-t * 7) + 0.6 * np.sin(2 * np.pi * f1 * 2.01 * t) * np.exp(-t * 12)
    s2 = np.sin(2 * np.pi * f2 * t) * np.exp(-t * 6)
    k = int(0.07 * SR)
    s[k:] += s2[: len(s) - k] * 0.8
    att = int(0.002 * SR)
    s[:att] *= np.linspace(0, 1, att)
    return s * 0.3


def pop_sfx(pitch=1.0):
    t = tt(0.12)
    f = (700 + 900 * np.exp(-t * 60)) * pitch
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35)
    return s * 0.35


def slam():
    t = tt(0.6)
    boom = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 6)
    snap = bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 50) * 0.5
    return np.tanh((boom + snap) * 1.4) * 0.6


def suck(length):
    t = tt(length)
    noise = rng.standard_normal(len(t))
    s = sweep_filter(noise, 6000, 300, 'band') * (t / length) ** 2
    return s * 0.5


def counter_roll(a, b, out, gain=0.18):
    t = a
    while t < b:
        k = (t - a) / (b - a)
        place(out, tick(int(t * 1000)), t, pan=rng.uniform(-0.3, 0.3), gain=gain * (1 - 0.6 * k))
        t += 0.025 + 0.09 * k ** 2

# ─── The score ───────────────────────────────────────────────────────────────
PROG = {'Bm': ['B2', 'F#3', 'A3', 'D4'], 'G': ['G2', 'D3', 'B3', 'F#4'], 'D': ['D3', 'A3', 'F#4', 'E4'], 'A': ['A2', 'E3', 'C#4', 'B4']}
ROOT = {'Bm': 'B1', 'G': 'G1', 'D': 'D2', 'A': 'A1'}
MELODY = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'B5', 'A5']


def cues(script):
    """Every sound cue, from the film's timings."""
    T = script['timings']
    splash, drop = T['splash'], T['drop']
    rows = [T['rowsScroll'][0] + (T['rowsScroll'][1] - T['rowsScroll'][0]) * i / 5 for i in range(6)]
    bar = [T['barRoll'][0] + (T['barRoll'][1] - T['barRoll'][0]) * x for x in (0.04, 0.12, 0.22, 0.36, 0.6, 0.94)]
    landings = sorted(
        [splash + ms / 1000 for ms in (420, 700, 980, 1260, 1540)] + [splash + 1.86]
        + [T['cardLand'], T['readCard'], T['totalLand'], T['ringLand'], T['whyDot']] + rows[1:] + bar
        + [T['marker'], T['numberLand'], T['pill'], T['closeLand']]
    )
    tags = [T['roll'][0] + (T['roll'][1] - T['roll'][0]) * (i + 0.5) / 6 for i in range(6)]
    return dict(T=T, splash=splash, drop=drop, landings=landings, tags=tags,
                notes=[n['at'] for n in script['notifications']],
                alert=script['alert']['at'], group=script['timings']['group'],
                glides=[g[0] for g in T['glides'].values()])


def music(c):
    T = c['T']
    drop, splash, close_land, end_hit = c['drop'], c['splash'], T['closeLand'], T['end'] - 0.5
    whip = T['glides']['number'][0]
    sections = [(drop, 12.0, 'Bm'), (12.0, 14.0, 'G'), (14.0, 16.0, 'D'), (16.0, 18.0, 'A'),
                (19.0, 20.5, 'Bm'), (20.5, 22.5, 'G'), (22.5, 24.5, 'D'), (24.5, whip, 'A'),
                (T['numberLand'], 28.5, 'G'), (28.5, 30.5, 'A'), (close_land, T['end'], 'D')]
    chord_at = lambda t: next((ch for a, b, ch in sections if a <= t < b), None)
    groove_on = lambda t: (drop <= t < 18.5) or (19.0 <= t < whip) or (close_land <= t < end_hit)
    drums, tonal, pads = buf(), buf(), buf()
    question = T['question']
    # Opening: marimba hook, shaker and kick from the first frame; drops back at tax season
    hook = ['B4', 'D5', 'F#5', 'D5', 'A5', 'F#5', 'D5', 'E5']
    for k in range(int(question / 0.25)):
        t = k * 0.25
        place(tonal, marimba(note(hook[k % 8])), t, pan=0.3 * np.sin(k), gain=0.24 + 0.1 * t / question)
    for k in range(int(question / B)):
        t = k * B
        g = 1.0 if t < c['group'] else 0.55
        place(drums, kick(0.8), t, gain=0.7 * g)
        if k % 2 == 1 and t < c['group']:
            place(drums, clap(), t, gain=0.5)
        place(drums, hat(), t + 0.25, pan=0.2, gain=0.45 * g)
        place(tonal, sub(note(ROOT[['Bm', 'G', 'D', 'A'][(k // 2) % 4]]), 0.4), t, gain=0.45)
    for k in range(int(question / 0.125)):
        place(drums, shaker(1.3 if k % 4 == 2 else 0.8), k * 0.125, pan=0.35, gain=0.75)
    # "So what do you owe?": an uneasy drone; then the splash; a roll into the drop
    drone = pad_voice(note('B1'), 2.6, bright=0.3, attack=0.05, release=0.4) + pad_voice(note('C3'), 2.6, bright=0.3, attack=0.4, release=0.4, seed=7)
    place(pads, drone, question, gain=0.10)
    place(pads, pad_voice(note('D3'), 3.1, bright=0.4, attack=0.4, release=0.4) + pad_voice(note('A3'), 3.1, bright=0.4, attack=0.4, release=0.4, seed=4), splash, gain=0.08)
    snare_roll(drop - 1.1, drop, drums, gain=0.22)
    # The groove: syncopated kick, rim and clap on 2 and 4, shaker sixteenths, log drums
    t = drop
    while t < end_hit:
        if groove_on(t):
            pos = int(round((t - drop) / 0.125)) % 16
            ch = chord_at(t)
            if pos in (0, 6, 8, 14):
                place(drums, kick(0.7), t, gain=0.75)
            if pos in (4, 12):
                place(drums, rim(), t, gain=0.7)
                place(drums, clap(), t, gain=0.3)
            place(drums, shaker(1.4 if pos % 4 == 2 else 0.7), t, pan=0.35, gain=0.8)
            if ch:
                if pos in (0, 3, 6, 10, 11):
                    place(tonal, log_drum(note(ROOT[ch]) * (4 if pos in (10, 11) else 2), 0.3), t, gain=0.55)
                if pos in (0, 8):
                    place(tonal, stab(PROG[ch], 0.6, 0.35), t, gain=0.10)
        t = round(t + 0.125, 6)
    for a, b, ch in sections:
        v = sum(pad_voice(note(nm), b - a, bright=0.45, attack=0.08, release=0.6, seed=i) for i, nm in enumerate(PROG[ch]))
        place(pads, v, a, gain=0.045 if a < whip else 0.075)
    for k in range(int((30.5 - T['numberLand']) / B)):  # the payoff: a soft heartbeat
        t = T['numberLand'] + k * B
        place(drums, hat(), t + 0.25, gain=0.4)
        if k % 2 == 0:
            place(drums, kick(0.3), t, gain=0.4)
    out = drums + tonal + reverb(pads, reverb_ir(2.2, 6000), 0.35)
    return reverb(out, reverb_ir(1.2, 8000, seed=6), 0.12)


def sfx(c):
    T = c['T']
    out = buf()
    for i, t in enumerate(c['notes']):  # a notification chime for each payment
        place(out, ding(note(['D6', 'E6', 'F#6', 'A6'][i % 4]), note(['A6', 'B6', 'D7', 'E7'][i % 4])), t, gain=0.55)
    place(out, whoosh(0.5, 4000, 300), c['group'], gain=0.35)  # the stack groups, navy wipes up
    # the urgent alert: an impact, a two-tone alarm, then a clock ticking under the countdown
    alert = c['alert']
    place(out, slam(), alert, gain=0.55)
    for k in range(6):
        f = 1320 if k % 2 == 0 else 990
        tb = tt(0.11)
        beep = np.sign(np.sin(2 * np.pi * f * tb)) * 0.5 + np.sin(2 * np.pi * f * tb) * 0.5
        beep = lp(beep * np.minimum(1, (0.11 - tb) / 0.01) * np.minimum(1, tb / 0.005), 5000) * 0.22
        place(out, beep, alert + 0.04 + k * 0.13, pan=-0.15 if k % 2 else 0.15, gain=0.8)
    t = alert + 0.9
    while t < T['gather'][0] - 0.1:
        place(out, tick(int(t * 1000)), t, pan=0.1, gain=0.3)
        t += 0.25
    for t in (T['season'], T['question']):
        place(out, slam(), t, gain=0.35)
    place(out, suck(0.65), T['gather'][0], gain=0.45)  # the alert becomes the ball
    place(out, pop_sfx(1.2), T['gather'][1] - 0.05, gain=0.45)
    for i, t in enumerate(c['landings']):  # the ball's voice
        f = note(MELODY[i % len(MELODY)])
        place(out, tap(f), t, pan=0.2 * np.sin(i * 1.3), gain=0.45)
        place(out, pluck(f * 2, decay=0.25, bright=0.3) * 0.5, t, pan=0.2 * np.sin(i * 1.3), gain=0.3)
    for t in c['tags']:
        place(out, tick(int(t * 1000)), t, gain=0.25)
    for t in c['glides']:  # soft air on each glide down the canvas
        place(out, whoosh(0.6, 300, 2500), t, gain=0.16)
    place(out, whoosh(3.1 - 2.54 + 0.05, 250, 7000), c['splash'] + 2.54, gain=0.3)  # through the O
    place(out, slam(), c['drop'], gain=0.4)
    place(out, pop_sfx(1.1), T['readCard'], gain=0.35)
    counter_roll(T['docs'] + 0.5, T['totalLand'], out, gain=0.15)
    place(out, bell(note('D6'), decay=1.2), T['totalLand'], gain=0.2)
    counter_roll(T['number'], T['numberLand'], out, gain=0.18)
    place(out, bell(note('D6'), decay=3.0), T['numberLand'], gain=0.45)
    for k, nm in enumerate(['A6', 'D7', 'F#7']):
        place(out, bell(note(nm), decay=0.8), T['pill'] + k * 0.06, gain=0.14)
    place(out, slam(), T['closeLand'], gain=0.35)
    place(out, bell(note('D5'), decay=4.0), T['end'] - 0.5, gain=0.3)
    return reverb(out, reverb_ir(1.4, 7000, seed=8), 0.15)


if __name__ == '__main__':
    script = json.load(open(sys.argv[1]))
    c = cues(script)
    s = sfx(c)
    m = music(c)
    write(sys.argv[2], m * 0.8 + s * 0.9)
    print('wrote', sys.argv[2])
