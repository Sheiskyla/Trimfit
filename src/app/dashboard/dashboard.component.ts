import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../services/auth.service';
import { DashboardDataService } from '../services/dashboard-data.service';
import { Subscription } from 'rxjs';

export interface Workout {
  id: string;
  title: string;
  category: string;
  status: 'Completed' | 'Planned';
  minutes: number;
  calories: number;
  startedAt: string; // ISO string YYYY-MM-DDTHH:mm
  notes?: string;
}

export interface UserSettings {
  name: string;
  calorieGoal: number;
  minutesGoal: number;
  waterGoalMl: number;
}

export interface Exercise {
  id: string;
  title: string;
  category: 'Upper Body' | 'Lower Body' | 'Core' | 'Cardio' | 'Full Body';
  icon: string;
  calPerMin: number;
  description: string;
  targetMuscles: string;
}

export interface SpotifyPreset {
  id: string;
  name: string;
  icon: string;
  tag: string;
  embedUrl: string;
  directUrl: string;
}

function getISO(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);
  private dashboardData = inject(DashboardDataService);
  private sanitizer = inject(DomSanitizer);
  private authSubscription?: Subscription;
  private userNameSubscription?: Subscription;

  // Real-Time Telemetry
  currentTimeDisplay = '';
  timeOfDayGreeting = 'Good Afternoon';
  isLiveConnected = true;

  // Real-Time Heart Rate Monitor
  heartRate = 72;
  heartRateZone = 'Resting (Zone 1)';
  liveBurnRate = 1.2;
  ecgPoints: number[] = [20, 25, 20, 55, 10, 30, 20, 22, 20, 25, 20, 22];

  private realTimeInterval: any = null;
  private heartInterval: any = null;

  // User Settings & Profile
  settings: UserSettings = {
    name: '',
    calorieGoal: 800,
    minutesGoal: 45,
    waterGoalMl: 3000
  };

  settingsDraft: UserSettings = { ...this.settings };
  showSettingsModal = false;

  // Workouts List
  workouts: Workout[] = [];

  // Default 8-Exercise Library
  defaultExercises: Exercise[] = [
    { id: 'ex-1', title: 'Push-ups', category: 'Upper Body', icon: 'bi-shield-shaded', calPerMin: 8, description: 'Classic chest, shoulder, and tricep strength builder.', targetMuscles: 'Chest, Shoulders, Triceps' },
    { id: 'ex-2', title: 'Bodyweight Squats', category: 'Lower Body', icon: 'bi-person-standing', calPerMin: 7, description: 'Build leg power, quad activation, and knee stability.', targetMuscles: 'Quads, Glutes, Hamstrings' },
    { id: 'ex-3', title: 'Plank', category: 'Core', icon: 'bi-body-text', calPerMin: 5, description: 'Isometric core hold for spinal stability & endurance.', targetMuscles: 'Abs, Obliques, Lower Back' },
    { id: 'ex-4', title: 'Jumping Jacks', category: 'Cardio', icon: 'bi-lightning-charge-fill', calPerMin: 10, description: 'High-energy cardiovascular conditioning jump.', targetMuscles: 'Full Body Cardio' },
    { id: 'ex-5', title: 'Burpees', category: 'Full Body', icon: 'bi-fire', calPerMin: 12, description: 'Maximum stamina, plyometric explosion, and fat burn.', targetMuscles: 'Chest, Legs, Core' },
    { id: 'ex-6', title: 'Lunges', category: 'Lower Body', icon: 'bi-person-walk', calPerMin: 8, description: 'Unilateral quad & glute strengthening step.', targetMuscles: 'Quads, Glutes, Calves' },
    { id: 'ex-7', title: 'Mountain Climbers', category: 'Cardio', icon: 'bi-speedometer2', calPerMin: 11, description: 'Rapid abdominal knee-drives with high cardiac output.', targetMuscles: 'Abs, Hip Flexors, Shoulders' },
    { id: 'ex-8', title: 'Bicycle Crunches', category: 'Core', icon: 'bi-arrow-repeat', calPerMin: 6, description: 'Rotational core crunch targeting the obliques.', targetMuscles: 'Obliques, Rectus Abdominis' }
  ];

  // Active Workout Focus Overlay / Modal Timer Engine
  activeWorkoutModalOpen = false;
  currentActiveExercise: Exercise | null = null;
  activeTimerRunning = false;
  activeElapsedSeconds = 0;
  activeBreakRunning = false;
  breakRemainingSeconds = 30;
  private activeWorkoutInterval: any = null;
  private breakInterval: any = null;

  // Streak Tracker State
  userStreakCount = 0;
  lastWorkoutDateStr = '';

  // BMI Calculator State
  bmiHeightCm = 175;
  bmiWeightKg = 70;
  computedBmi: number | null = 22.9;
  bmiCategory: 'Underweight' | 'Normal' | 'Overweight' | 'Obese' = 'Normal';
  bmiIdealMinKg = 56.7;
  bmiIdealMaxKg = 76.3;

  // Spotify Quick Player Widget Presets
  spotifyPresets: SpotifyPreset[] = [
    {
      id: 'cardio',
      name: 'Cardio Hype',
      icon: 'bi-lightning-charge-fill',
      tag: 'High Tempo Beats ⚡',
      embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX76Wlfd1162M?utm_source=generator&theme=0',
      directUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfd1162M'
    },
    {
      id: 'strength',
      name: 'Strength Heavy',
      icon: 'bi-bar-chart-line-fill',
      tag: 'Heavy Gym Hits 🏋️',
      embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX321uKi8yZWF?utm_source=generator&theme=0',
      directUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX321uKi8yZWF'
    },
    {
      id: 'zen',
      name: 'Zen Stretches',
      icon: 'bi-heart-pulse-fill',
      tag: 'Flow & Recovery 🧘',
      embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX9uKNf5jVv27?utm_source=generator&theme=0',
      directUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX9uKNf5jVv27'
    }
  ];
  selectedSpotifyPreset: SpotifyPreset = this.spotifyPresets[0];

  // Categories & Filters State
  categories: string[] = ['Cardio', 'Upper Body', 'Lower Body', 'Core', 'Full Body', 'Strength', 'Cycling', 'Yoga'];
  search = '';
  categoryFilter = 'All';
  statusFilter = 'All';
  sortKey = 'recent';

  // Manual Custom Workout Modal State
  showWorkoutModal = false;
  editingId: string | null = null;
  formError: string | null = null;
  draft = {
    title: '',
    category: 'Cardio',
    status: 'Completed' as 'Completed' | 'Planned',
    minutes: null as number | null,
    calories: null as number | null,
    startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
    notes: ''
  };

  // Toast Notification State
  toastText: string | null = null;
  toastActionLabel: string | null = null;
  private deletedWorkoutBackup: { workout: Workout; index: number } | null = null;
  private toastTimeout: any = null;

  // Stopwatch / Live Timer State
  timerRunning = false;
  elapsedMs = 0;
  laps: number[] = [];
  private timerInterval: any = null;

  // Water Hydration Tracker
  todayWaterMl = 0;
  waterHistory: number[] = [];
  customWaterMl: number | null = null;

  ngOnInit(): void {
    this.syncUserName();

    this.authSubscription = this.auth.user$.subscribe(() => {
      this.syncUserName();
    });

    this.userNameSubscription = this.auth.userName$.subscribe((name) => {
      if (name) {
        this.settings.name = name;
        this.settingsDraft.name = name;
        this.cdr.markForCheck();
      }
    });

    this.loadFromLocalStorage();
    void this.loadFromFirebase();
    this.initRealTimeClock();
    this.initRealTimeHeartRate();
    this.calculateBmi();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (this.realTimeInterval) clearInterval(this.realTimeInterval);
    if (this.heartInterval) clearInterval(this.heartInterval);
    if (this.activeWorkoutInterval) clearInterval(this.activeWorkoutInterval);
    if (this.breakInterval) clearInterval(this.breakInterval);
    this.authSubscription?.unsubscribe();
    this.userNameSubscription?.unsubscribe();
  }

  private syncUserName(): void {
    const name = this.auth.currentUserName || localStorage.getItem('trimfit_user_name');
    if (name) {
      this.settings.name = name;
      this.settingsDraft.name = name;
      this.cdr.markForCheck();
    }
  }

  // AI Coach Insights getter
  get aiCoachAdvice(): string {
    const calPct = this.caloriePct;
    const watPct = this.waterPct;
    if (this.timerRunning || this.activeTimerRunning) {
      return '⚡ Live workout active! Maintain your breathing pace and stay hydrated.';
    }
    if (watPct < 50) {
      return `💧 Hydration check: You are at ${watPct}% of your water goal. Log +500ml now to stay optimized!`;
    }
    if (calPct >= 100) {
      return `🔥 Outstanding! You've crushed 100% of today's calorie goal (${this.todayCalories} kcal burned)!`;
    }
    if (calPct >= 50) {
      return `💪 Solid progress! You are ${100 - calPct}% away from your daily goal. A quick 15m session will seal it!`;
    }
    return `🚀 Ready for today's session? Select an exercise from the library to start tracking live!`;
  }

  // Live Stopwatch / Quick Timer
  toggleTimer(): void {
    if (this.timerRunning) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerRunning = false;
      this.cdr.markForCheck();
      this.showToast(`Timer paused at ${this.formatClock(this.elapsedMs)}`);
    } else {
      this.timerRunning = true;
      const startTime = Date.now() - this.elapsedMs;
      this.timerInterval = setInterval(() => {
        this.elapsedMs = Date.now() - startTime;
        this.cdr.markForCheck();
      }, 50);
      this.cdr.markForCheck();
    }
  }

  formatClock(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}.${tenths}`;
    }
    return `${pad(m)}:${pad(s)}.${tenths}`;
  }

  addLap(): void {
    if (this.elapsedMs > 0) {
      this.laps.unshift(this.elapsedMs);
      this.cdr.markForCheck();
    }
  }

  resetTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerRunning = false;
    this.elapsedMs = 0;
    this.laps = [];
    this.cdr.markForCheck();
  }

  logTimedSession(): void {
    const mins = Math.max(1, Math.round(this.elapsedMs / 60000));
    const estimatedCals = Math.max(10, Math.floor(this.elapsedMs / 1000 * 0.15));

    this.draft = {
      title: 'Live Timed Session',
      category: 'Cardio',
      status: 'Completed',
      minutes: mins,
      calories: estimatedCals,
      startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
      notes: `Recorded live stopwatch (${this.formatClock(this.elapsedMs)})`
    };
    this.editingId = null;
    this.formError = null;
    this.showWorkoutModal = true;
    this.resetTimer();
  }


  // Real-Time Clock & Heart Rate Telemetry
  private initRealTimeClock(): void {
    this.updateClock();
    this.realTimeInterval = setInterval(() => {
      this.updateClock();
    }, 1000);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTimeDisplay = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const hours = now.getHours();
    if (hours < 12) {
      this.timeOfDayGreeting = 'Good Morning';
    } else if (hours < 18) {
      this.timeOfDayGreeting = 'Good Afternoon';
    } else {
      this.timeOfDayGreeting = 'Good Evening';
    }
    this.cdr.markForCheck();
  }

  private initRealTimeHeartRate(): void {
    this.updateHeartRate();
    this.heartInterval = setInterval(() => {
      this.updateHeartRate();
    }, 1500);
  }

  private updateHeartRate(): void {
    if (this.timerRunning || this.activeTimerRunning) {
      const targetBpm = 136 + Math.floor(Math.sin(Date.now() / 1500) * 16);
      this.heartRate = targetBpm;
      this.liveBurnRate = parseFloat((targetBpm * 0.065).toFixed(1));

      if (this.heartRate >= 140) {
        this.heartRateZone = 'Anaerobic (Zone 4)';
      } else if (this.heartRate >= 120) {
        this.heartRateZone = 'Aerobic Burn (Zone 3)';
      } else {
        this.heartRateZone = 'Warmup (Zone 2)';
      }
    } else {
      const delta = Math.floor((Math.random() - 0.5) * 4);
      this.heartRate = Math.min(84, Math.max(64, this.heartRate + delta));
      this.liveBurnRate = 1.2;
      this.heartRateZone = 'Resting (Zone 1)';
    }

    const spike = (this.timerRunning || this.activeTimerRunning)
      ? (Math.random() > 0.5 ? 45 : 12)
      : (Math.random() > 0.75 ? 35 : 15);
    this.ecgPoints.push(spike);
    if (this.ecgPoints.length > 14) {
      this.ecgPoints.shift();
    }
    this.cdr.markForCheck();
  }

  get ecgSvgPath(): string {
    const points = this.ecgPoints;
    const width = 120;
    const step = width / (points.length - 1);
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${45 - p}`).join(' ');
  }

  // Active Workout Focus Modal & Timer Engine
  startExerciseTimer(ex: Exercise): void {
    this.currentActiveExercise = ex;
    this.activeElapsedSeconds = 0;
    this.activeTimerRunning = true;
    this.activeBreakRunning = false;
    this.activeWorkoutModalOpen = true;

    if (this.activeWorkoutInterval) clearInterval(this.activeWorkoutInterval);
    this.activeWorkoutInterval = setInterval(() => {
      if (this.activeTimerRunning && !this.activeBreakRunning) {
        this.activeElapsedSeconds++;
        this.cdr.markForCheck();
      }
    }, 1000);
  }

  pauseActiveTimer(): void {
    this.activeTimerRunning = !this.activeTimerRunning;
    if (this.activeTimerRunning) {
      this.activeBreakRunning = false;
    }
    this.cdr.markForCheck();
  }

  takeABreak(seconds = 30): void {
    this.activeBreakRunning = true;
    this.breakRemainingSeconds = seconds;
    if (this.breakInterval) clearInterval(this.breakInterval);
    this.breakInterval = setInterval(() => {
      if (this.breakRemainingSeconds > 0) {
        this.breakRemainingSeconds--;
        this.cdr.markForCheck();
      } else {
        clearInterval(this.breakInterval);
        this.activeBreakRunning = false;
        this.cdr.markForCheck();
      }
    }, 1000);
  }

  skipBreak(): void {
    if (this.breakInterval) clearInterval(this.breakInterval);
    this.activeBreakRunning = false;
    this.cdr.markForCheck();
  }

  get activeBurnedCalories(): number {
    if (!this.currentActiveExercise) return 0;
    const mins = this.activeElapsedSeconds / 60;
    return Math.max(1, Math.round(mins * this.currentActiveExercise.calPerMin));
  }

  completeActiveWorkout(): void {
    if (!this.currentActiveExercise) return;
    const mins = Math.max(1, Math.round(this.activeElapsedSeconds / 60));
    const calories = this.activeBurnedCalories || Math.max(10, mins * this.currentActiveExercise.calPerMin);

    const newW: Workout = {
      id: 'act-' + Date.now(),
      title: this.currentActiveExercise.title,
      category: this.currentActiveExercise.category,
      status: 'Completed',
      minutes: mins,
      calories: calories,
      startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
      notes: `Interactive workout completed live (${this.formatSeconds(this.activeElapsedSeconds)})`
    };

    this.workouts.unshift(newW);
    this.incrementStreakOnWorkout();
    this.saveDataToLocalStorage();
    void this.saveToFirebase();

    this.showToast(`🔥 Workout complete! "${this.currentActiveExercise.title}" (+${calories} kcal burned)! 🎉`);
    this.closeActiveWorkoutModal();
  }

  closeActiveWorkoutModal(): void {
    if (this.activeWorkoutInterval) clearInterval(this.activeWorkoutInterval);
    if (this.breakInterval) clearInterval(this.breakInterval);
    this.activeTimerRunning = false;
    this.activeBreakRunning = false;
    this.activeWorkoutModalOpen = false;
    this.currentActiveExercise = null;
    this.activeElapsedSeconds = 0;
    this.cdr.markForCheck();
  }

  formatSeconds(totalSec: number): string {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Daily Streak Manager
  get streak(): number {
    if (this.userStreakCount > 0) return this.userStreakCount;
    return this.calculateStreakFromWorkouts();
  }

  private calculateStreakFromWorkouts(): number {
    const completed = this.workouts.filter(w => w.status === 'Completed');
    if (completed.length === 0) return 0;

    const dates = Array.from(new Set(completed.map(w => {
      const d = new Date(w.startedAt);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }))).sort().reverse();

    const todayStr = getISO(0, 0, 0).slice(0, 10);
    const yesterdayStr = getISO(1, 0, 0).slice(0, 10);

    if (!dates.includes(todayStr) && !dates.includes(yesterdayStr)) {
      return 0;
    }

    let currentStreak = 0;
    let checkDate = new Date();
    if (!dates.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ds = `${checkDate.getFullYear()}-${pad(checkDate.getMonth() + 1)}-${pad(checkDate.getDate())}`;
      if (dates.includes(ds)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return currentStreak;
  }

  private incrementStreakOnWorkout(): void {
    const todayStr = getISO(0, 0, 0).slice(0, 10);
    const yesterdayStr = getISO(1, 0, 0).slice(0, 10);

    if (this.lastWorkoutDateStr === todayStr) {
      return;
    } else if (this.lastWorkoutDateStr === yesterdayStr) {
      this.userStreakCount = (this.userStreakCount || 1) + 1;
    } else {
      this.userStreakCount = 1;
    }
    this.lastWorkoutDateStr = todayStr;
    localStorage.setItem('trimfit_streak_count', this.userStreakCount.toString());
    localStorage.setItem('trimfit_last_workout_date', todayStr);
  }

  // BMI Calculator Widget
  calculateBmi(): void {
    if (!this.bmiHeightCm || !this.bmiWeightKg || this.bmiHeightCm <= 0 || this.bmiWeightKg <= 0) return;
    const heightM = this.bmiHeightCm / 100;
    const bmi = this.bmiWeightKg / (heightM * heightM);
    this.computedBmi = parseFloat(bmi.toFixed(1));

    if (bmi < 18.5) {
      this.bmiCategory = 'Underweight';
    } else if (bmi < 25.0) {
      this.bmiCategory = 'Normal';
    } else if (bmi < 30.0) {
      this.bmiCategory = 'Overweight';
    } else {
      this.bmiCategory = 'Obese';
    }

    this.bmiIdealMinKg = parseFloat((18.5 * heightM * heightM).toFixed(1));
    this.bmiIdealMaxKg = parseFloat((24.9 * heightM * heightM).toFixed(1));

    localStorage.setItem('trimfit_bmi_data', JSON.stringify({
      height: this.bmiHeightCm,
      weight: this.bmiWeightKg,
      bmi: this.computedBmi,
      category: this.bmiCategory,
      minIdeal: this.bmiIdealMinKg,
      maxIdeal: this.bmiIdealMaxKg
    }));
    this.cdr.markForCheck();
  }

  get bmiCategoryBadgeClass(): string {
    switch (this.bmiCategory) {
      case 'Underweight': return 'badge-cyan';
      case 'Normal': return 'badge-success';
      case 'Overweight': return 'badge-warning';
      case 'Obese': return 'badge-danger';
      default: return 'badge-success';
    }
  }

  // Spotify Quick Player Widget
  selectSpotifyPreset(presetId: string): void {
    const found = this.spotifyPresets.find(p => p.id === presetId);
    if (found) {
      this.selectedSpotifyPreset = found;
      this.cdr.markForCheck();
    }
  }

  getSafeSpotifyUrl(embedUrl: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  // Retake & Routine Actions
  retakeWorkout(w: Workout): void {
    const matched = this.defaultExercises.find(e => e.title.toLowerCase() === w.title.toLowerCase()) || {
      id: 'ex-retake',
      title: w.title,
      category: (w.category as any) || 'Cardio',
      icon: this.iconFor(w.category),
      calPerMin: w.minutes > 0 ? Math.round(w.calories / w.minutes) : 8,
      description: 'Retake routine exercise session',
      targetMuscles: 'Full Body'
    };
    this.startExerciseTimer(matched);
  }

  // Identity & Greetings
  get greetingName(): string {
    const raw = this.settings.name || this.auth.currentUserName || localStorage.getItem('trimfit_user_name') || 'User';
    return raw.trim().split(' ')[0];
  }

  get initials(): string {
    const name = this.settings.name || this.auth.currentUserName || localStorage.getItem('trimfit_user_name') || 'TM';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  get hasWorkouts(): boolean {
    return this.workouts.length > 0;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  get completedToday(): number {
    const today = new Date();
    return this.workouts.filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today)).length;
  }

  get plannedAhead(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.workouts.filter(w => w.status === 'Planned' && new Date(w.startedAt) >= today).length;
  }

  // Daily Dashboard Stats
  get todayCalories(): number {
    const today = new Date();
    const logged = this.workouts
      .filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today))
      .reduce((sum, w) => sum + (w.calories || 0), 0);

    const liveStopwatchCals = this.timerRunning ? Math.floor(this.elapsedMs / 1000 * 0.15) : 0;
    const activeModalCals = this.activeTimerRunning ? this.activeBurnedCalories : 0;
    return logged + liveStopwatchCals + activeModalCals;
  }

  get caloriePct(): number {
    const goal = this.settings.calorieGoal || 1;
    return Math.min(100, Math.round((this.todayCalories / goal) * 100));
  }

  get todayMinutes(): number {
    const today = new Date();
    const logged = this.workouts
      .filter(w => w.status === 'Completed' && this.isSameDay(new Date(w.startedAt), today))
      .reduce((sum, w) => sum + (w.minutes || 0), 0);

    const liveMins = this.timerRunning ? Math.floor(this.elapsedMs / 60000) : 0;
    const activeMins = this.activeTimerRunning ? Math.floor(this.activeElapsedSeconds / 60) : 0;
    return logged + liveMins + activeMins;
  }

  get minutesPct(): number {
    const goal = this.settings.minutesGoal || 1;
    return Math.min(100, Math.round((this.todayMinutes / goal) * 100));
  }

  get waterPct(): number {
    const goal = this.settings.waterGoalMl || 1;
    return Math.min(100, Math.round((this.todayWaterMl / goal) * 100));
  }

  formatLitres(ml: number): string {
    return ((ml || 0) / 1000).toFixed(1);
  }

  get weekSessions(): number {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return this.workouts.filter(w => w.status === 'Completed' && new Date(w.startedAt) >= sevenDaysAgo).length;
  }

  get weekCalories(): number {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return this.workouts
      .filter(w => w.status === 'Completed' && new Date(w.startedAt) >= sevenDaysAgo)
      .reduce((sum, w) => sum + (w.calories || 0), 0);
  }

  // 7-Day Weekly Chart
  get weekBars() {
    const days = [];
    const now = new Date();

    let maxCalories = this.settings.calorieGoal || 800;
    const dailyTotals: { [key: string]: { calories: number; minutes: number } } = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      dailyTotals[key] = { calories: 0, minutes: 0 };
    }

    this.workouts.forEach(w => {
      if (w.status === 'Completed') {
        const d = new Date(w.startedAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (dailyTotals[key]) {
          dailyTotals[key].calories += w.calories || 0;
          dailyTotals[key].minutes += w.minutes || 0;
        }
      }
    });

    Object.values(dailyTotals).forEach(t => {
      if (t.calories > maxCalories) {
        maxCalories = t.calories;
      }
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const stats = dailyTotals[key] || { calories: 0, minutes: 0 };

      if (i === 0 && this.timerRunning) {
        stats.calories += Math.floor(this.elapsedMs / 1000 * 0.15);
      }

      const height = maxCalories > 0 ? Math.min(100, Math.max(6, Math.round((stats.calories / maxCalories) * 100))) : 6;

      days.push({
        label: i === 0 ? 'Today' : dayLabels[d.getDay()],
        calories: stats.calories,
        minutes: stats.minutes,
        height,
        hit: stats.calories >= this.settings.calorieGoal,
        isToday: i === 0,
        key
      });
    }

    return days;
  }

  trackByKey(index: number, item: any): string {
    return item.key;
  }

  // Filtering & Sorting
  get filtersActive(): boolean {
    return this.search.trim() !== '' || this.categoryFilter !== 'All' || this.statusFilter !== 'All' || this.sortKey !== 'recent';
  }

  clearFilters(): void {
    this.search = '';
    this.categoryFilter = 'All';
    this.statusFilter = 'All';
    this.sortKey = 'recent';
  }

  get visible(): Workout[] {
    return this.workouts
      .filter(w => {
        if (this.categoryFilter !== 'All' && w.category !== this.categoryFilter) {
          return false;
        }
        if (this.statusFilter !== 'All' && w.status !== this.statusFilter) {
          return false;
        }
        if (this.search.trim()) {
          const q = this.search.toLowerCase().trim();
          const matchTitle = w.title.toLowerCase().includes(q);
          const matchCategory = w.category.toLowerCase().includes(q);
          const matchNotes = w.notes ? w.notes.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchCategory && !matchNotes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (this.sortKey === 'calories') {
          return b.calories - a.calories;
        }
        if (this.sortKey === 'minutes') {
          return b.minutes - a.minutes;
        }
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
  }

  trackById(index: number, item: Workout): string {
    return item.id;
  }

  iconFor(category: string): string {
    const map: Record<string, string> = {
      'Upper Body': 'bi-shield-shaded',
      'Lower Body': 'bi-person-standing',
      'Core': 'bi-body-text',
      'Cardio': 'bi-lightning-charge-fill',
      'Full Body': 'bi-fire',
      'Strength': 'bi-bar-chart-line-fill',
      'Cycling': 'bi-bicycle',
      'Running': 'bi-person-walking',
      'Yoga': 'bi-heart-pulse-fill'
    };
    return map[category] || 'bi-activity';
  }

  formatWhen(startedAt: string): string {
    if (!startedAt) return '';
    const d = new Date(startedAt);
    if (isNaN(d.getTime())) return startedAt;

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (d.toDateString() === todayStr) {
      return `Today, ${timeStr}`;
    } else if (d.toDateString() === yesterdayStr) {
      return `Yesterday, ${timeStr}`;
    } else {
      const month = d.toLocaleDateString([], { month: 'short' });
      const day = d.getDate();
      return `${month} ${day}, ${timeStr}`;
    }
  }

  toggleStatus(w: Workout): void {
    w.status = w.status === 'Completed' ? 'Planned' : 'Completed';
    this.saveDataToLocalStorage();
    void this.saveToFirebase();
    this.showToast(`Session "${w.title}" marked as ${w.status}`);
  }

  deleteWorkout(w: Workout): void {
    const index = this.workouts.findIndex(item => item.id === w.id);
    if (index !== -1) {
      this.deletedWorkoutBackup = { workout: w, index };
      this.workouts.splice(index, 1);
      this.saveDataToLocalStorage();
      void this.saveToFirebase();
      this.showToast(`Deleted "${w.title}"`, 'Undo');
    }
  }

  undoDelete(): void {
    if (this.deletedWorkoutBackup) {
      this.workouts.splice(this.deletedWorkoutBackup.index, 0, this.deletedWorkoutBackup.workout);
      this.deletedWorkoutBackup = null;
      this.saveDataToLocalStorage();
      void this.saveToFirebase();
      this.showToast('Session restored!');
    }
  }

  // Workout Modal Handlers
  openWorkoutModal(w?: Workout): void {
    if (w) {
      this.editingId = w.id;
      this.draft = {
        title: w.title,
        category: w.category,
        status: w.status,
        minutes: w.minutes,
        calories: w.calories,
        startedAt: w.startedAt,
        notes: w.notes || ''
      };
    } else {
      this.editingId = null;
      this.draft = {
        title: '',
        category: 'Cardio',
        status: 'Completed',
        minutes: 30,
        calories: 250,
        startedAt: getISO(0, new Date().getHours(), new Date().getMinutes()),
        notes: ''
      };
    }
    this.formError = null;
    this.showWorkoutModal = true;
  }

  closeWorkoutModal(): void {
    this.showWorkoutModal = false;
    this.editingId = null;
    this.formError = null;
  }

  saveWorkout(): void {
    if (!this.draft.title.trim()) {
      this.formError = 'Please provide a session name.';
      return;
    }
    if (!this.draft.minutes || this.draft.minutes <= 0) {
      this.formError = 'Please enter a valid duration in minutes.';
      return;
    }
    if (this.draft.calories === null || this.draft.calories < 0) {
      this.formError = 'Please enter valid calories burned.';
      return;
    }

    if (this.editingId) {
      const idx = this.workouts.findIndex(w => w.id === this.editingId);
      if (idx !== -1) {
        this.workouts[idx] = {
          ...this.workouts[idx],
          title: this.draft.title.trim(),
          category: this.draft.category,
          status: this.draft.status,
          minutes: Number(this.draft.minutes),
          calories: Number(this.draft.calories),
          startedAt: this.draft.startedAt || getISO(0, new Date().getHours(), new Date().getMinutes()),
          notes: this.draft.notes.trim() || undefined
        };
        this.showToast(`Updated session "${this.draft.title}"`);
      }
    } else {
      const newW: Workout = {
        id: 'act-' + Date.now(),
        title: this.draft.title.trim(),
        category: this.draft.category,
        status: this.draft.status,
        minutes: Number(this.draft.minutes),
        calories: Number(this.draft.calories),
        startedAt: this.draft.startedAt || getISO(0, new Date().getHours(), new Date().getMinutes()),
        notes: this.draft.notes.trim() || undefined
      };
      this.workouts.unshift(newW);
      if (newW.status === 'Completed') {
        this.incrementStreakOnWorkout();
      }
      this.showToast(`Logged new session "${newW.title}"!`);
    }

    this.saveDataToLocalStorage();
    void this.saveToFirebase();
    this.closeWorkoutModal();
  }

  // Water Hydration Tracker
  addWater(amountMl: number): void {
    this.todayWaterMl += amountMl;
    this.waterHistory.push(amountMl);
    this.saveDataToLocalStorage();
    void this.saveToFirebase();
    this.showToast(`+${amountMl} ml water logged. Stay hydrated!`);
  }

  addCustomWater(): void {
    if (this.customWaterMl && this.customWaterMl > 0) {
      this.addWater(this.customWaterMl);
      this.customWaterMl = null;
    }
  }

  undoLastWater(): void {
    if (this.waterHistory.length > 0) {
      const last = this.waterHistory.pop()!;
      this.todayWaterMl = Math.max(0, this.todayWaterMl - last);
      this.saveDataToLocalStorage();
      void this.saveToFirebase();
      this.showToast(`Undid -${last} ml water entry.`);
    }
  }

  // Settings Modal Handlers
  openSettingsModal(): void {
    this.settingsDraft = { ...this.settings };
    this.showSettingsModal = true;
  }

  closeSettingsModal(): void {
    this.showSettingsModal = false;
  }

  saveSettings(): void {
    if (!this.settingsDraft.name.trim()) {
      this.settingsDraft.name = this.auth.currentUserName || 'User';
    }
    this.settings = {
      name: this.settingsDraft.name.trim(),
      calorieGoal: Number(this.settingsDraft.calorieGoal) || 800,
      minutesGoal: Number(this.settingsDraft.minutesGoal) || 45,
      waterGoalMl: Number(this.settingsDraft.waterGoalMl) || 3000
    };
    this.saveDataToLocalStorage();
    void this.saveToFirebase();
    this.closeSettingsModal();
    this.showToast('Fitness goals and settings saved!');
  }

  // Toast Helpers
  dismissToast(): void {
    this.toastText = null;
    this.toastActionLabel = null;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  private showToast(msg: string, actionLabel: string | null = null): void {
    this.dismissToast();
    this.toastText = msg;
    this.toastActionLabel = actionLabel;
    this.toastTimeout = setTimeout(() => {
      this.dismissToast();
    }, 4500);
  }

  // Data Persistence Helpers
  private saveDataToLocalStorage(): void {
    try {
      localStorage.setItem('trimfit_workouts', JSON.stringify(this.workouts));
      localStorage.setItem('trimfit_water', JSON.stringify({ todayWaterMl: this.todayWaterMl, waterHistory: this.waterHistory }));
      localStorage.setItem('trimfit_settings', JSON.stringify(this.settings));
      if (this.settings.name) {
        localStorage.setItem('trimfit_user_name', this.settings.name);
      }
    } catch {
      // Fallback
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const storedWorkouts = localStorage.getItem('trimfit_workouts');
      if (storedWorkouts) {
        this.workouts = JSON.parse(storedWorkouts);
      }
      const storedWater = localStorage.getItem('trimfit_water');
      if (storedWater) {
        const wData = JSON.parse(storedWater);
        this.todayWaterMl = wData.todayWaterMl || 0;
        this.waterHistory = wData.waterHistory || [];
      }
      const storedStreak = localStorage.getItem('trimfit_streak_count');
      if (storedStreak) {
        this.userStreakCount = parseInt(storedStreak, 10);
      }
      this.lastWorkoutDateStr = localStorage.getItem('trimfit_last_workout_date') || '';
      this.loadBmiFromLocalStorage();
    } catch {
      // Fallback
    }
  }

  private loadBmiFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem('trimfit_bmi_data');
      if (raw) {
        const data = JSON.parse(raw);
        this.bmiHeightCm = data.height || 175;
        this.bmiWeightKg = data.weight || 70;
        this.computedBmi = data.bmi || 22.9;
        this.bmiCategory = data.category || 'Normal';
        this.bmiIdealMinKg = data.minIdeal || 56.7;
        this.bmiIdealMaxKg = data.maxIdeal || 76.3;
      }
    } catch {
      // Fallback
    }
  }

  private async loadFromFirebase(): Promise<void> {
    try {
      const data = await this.dashboardData.load();
      const user = this.auth.currentUser;
      const firebaseUserName = this.auth.currentUserName || 'User';

      if (data) {
        this.settings = data.settings;
        if (user?.displayName) {
          this.settings.name = user.displayName;
        } else if (!this.settings.name || this.settings.name === 'Alex Morgan') {
          this.settings.name = firebaseUserName;
        }
        if (data.workouts && data.workouts.length > 0) {
          this.workouts = data.workouts as Workout[];
        }
        this.todayWaterMl = data.todayWaterMl || this.todayWaterMl;
        this.waterHistory = data.waterHistory || this.waterHistory;
      } else if (user) {
        this.settings.name = firebaseUserName;
      }

      this.settingsDraft = { ...this.settings };
      this.cdr.markForCheck();
    } catch {
      // Firebase fallback to local
    }
  }

  private async saveToFirebase(): Promise<void> {
    try {
      await this.dashboardData.save({
        settings: this.settings,
        todayWaterMl: this.todayWaterMl,
        waterHistory: this.waterHistory,
        workouts: this.workouts
      });
    } catch {
      // Quiet fallback
    }
  }
}
