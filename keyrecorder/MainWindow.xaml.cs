using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using KeyRecorder.Models;
using KeyRecorder.Services;
using Microsoft.Win32;

namespace KeyRecorder
{
    public partial class MainWindow : Window
    {
        private readonly Win32Hook _hook;
        private readonly MacroPlayer _macroPlayer;
        private readonly MacroManager _macroManager;

        private readonly List<KeyEventRecord> _rawEvents = new();
        private readonly ObservableCollection<KeyEventRecord> _observableEvents = new();
        private readonly ObservableCollection<MacroProfile> _savedMacros = new();
        
        private readonly DispatcherTimer _timer;
        private readonly Stopwatch _recordingStopwatch = new();
        private bool _isUpdatingTextProgrammatically = false;
        private bool _isTextManuallyEdited = false;

        public MainWindow()
        {
            InitializeComponent();

            ListRawEvents.ItemsSource = _observableEvents;
            ListSavedMacros.ItemsSource = _savedMacros;

            _timer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(50)
            };
            _timer.Tick += Timer_Tick;

            _macroManager = new MacroManager();
            _macroPlayer = new MacroPlayer();
            _macroPlayer.ProgressChanged += MacroPlayer_ProgressChanged;
            _macroPlayer.PlaybackStarted += MacroPlayer_PlaybackStarted;
            _macroPlayer.PlaybackStopped += MacroPlayer_PlaybackStopped;

            _hook = new Win32Hook();
            _hook.KeyRecorded += Hook_KeyRecorded;
            _hook.RecordingStateChanged += Hook_RecordingStateChanged;
            _hook.PlaybackHotKeyTriggered += Hook_PlaybackHotKeyTriggered;

            try
            {
                _hook.StartHook();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Could not initialize global keyboard hook: {ex.Message}", "Hook Error", MessageBoxButton.OK, MessageBoxImage.Warning);
            }

            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            UpdateFormatting();
            RefreshMacroList();
        }

        private void MainWindow_Closed(object? sender, EventArgs e)
        {
            _macroPlayer.Stop();
            _hook.Dispose();
        }

        #region Hook & Recording Handlers

        private void Hook_RecordingStateChanged(bool isRecording)
        {
            Dispatcher.InvokeAsync(() =>
            {
                if (isRecording)
                {
                    // If macro was playing, stop it
                    if (_macroPlayer.IsPlaying)
                    {
                        _macroPlayer.Stop();
                    }

                    _recordingStopwatch.Restart();
                    _timer.Start();

                    // Update UI for Recording State
                    BtnRecordToggle.Style = (Style)FindResource("RecordStopButton");
                    TxtRecordIcon.Text = "■";
                    TxtRecordIcon.Foreground = new SolidColorBrush(Color.FromRgb(255, 255, 255));
                    TxtRecordLabel.Text = "STOP REC";

                    BtnPlayMacroToggle.IsEnabled = false;

                    BorderStatusBadge.Background = new SolidColorBrush(Color.FromRgb(60, 20, 26));
                    PulseIndicator.Fill = new SolidColorBrush(Color.FromRgb(239, 68, 68));
                    TxtStatus.Text = "● RECORDING";
                    TxtStatus.Foreground = new SolidColorBrush(Color.FromRgb(248, 113, 113));

                    TxtLiveEventFeedback.Text = "Recording live keystrokes & chords... Press F4 anytime to stop.";
                    ShowToast("🔴 Recording started! Press keys (or hold multiple keys), then press F4 to stop.", "#F87171");

                    SoundFeedback.PlayStartSound();
                }
                else
                {
                    _recordingStopwatch.Stop();
                    _timer.Stop();

                    // Update UI for Standby State
                    BtnRecordToggle.Style = (Style)FindResource("RecordStartButton");
                    TxtRecordIcon.Text = "●";
                    TxtRecordIcon.Foreground = new SolidColorBrush(Color.FromRgb(0, 245, 160));
                    TxtRecordLabel.Text = "RECORD";

                    BtnPlayMacroToggle.IsEnabled = true;

                    BorderStatusBadge.Background = new SolidColorBrush(Color.FromRgb(33, 38, 45));
                    PulseIndicator.Fill = new SolidColorBrush(Color.FromRgb(139, 148, 158));
                    TxtStatus.Text = "STANDBY";
                    TxtStatus.Foreground = new SolidColorBrush(Color.FromRgb(139, 148, 158));

                    TxtLiveEventFeedback.Text = $"Recording stopped. Total events: {_rawEvents.Count}. Instructions formatted below.";
                    ShowToast("✅ Recording stopped! Macro instructions generated.", "#34D399");

                    SoundFeedback.PlayStopSound();
                    UpdateFormatting();
                }
            });
        }

        private void Hook_KeyRecorded(KeyEventRecord record)
        {
            Dispatcher.InvokeAsync(() =>
            {
                _rawEvents.Add(record);
                _observableEvents.Add(record);

                if (ListRawEvents.Items.Count > 0)
                {
                    ListRawEvents.ScrollIntoView(ListRawEvents.Items[^1]);
                }

                TxtEventCount.Text = $"{_rawEvents.Count} events";
                TxtLiveEventFeedback.Text = $"Latest: [{(record.IsKeyDown ? "DOWN" : "UP")}] {record.KeyName} (+{record.TimestampMs}ms)";

                UpdateFormatting();
            });
        }

        private void Hook_PlaybackHotKeyTriggered()
        {
            Dispatcher.InvokeAsync(() =>
            {
                ToggleMacroPlayback();
            });
        }

        #endregion

        #region Macro Playback Handlers & Logic

        private void BtnPlayMacroToggle_Click(object sender, RoutedEventArgs e)
        {
            ToggleMacroPlayback();
        }

        private void ToggleMacroPlayback()
        {
            if (_macroPlayer.IsPlaying)
            {
                _macroPlayer.Stop();
                return;
            }

            if (_hook.IsRecording)
            {
                _hook.StopRecording();
            }

            string scriptText = TxtOutput?.Text ?? string.Empty;
            var dualTrack = KeyInstructionFormatter.ParseDualTrackFromString(scriptText);

            if (dualTrack.TotalCount == 0)
            {
                ShowToast("⚠️ No instructions to play. Record keys or type instructions in the editor!", "#FBBF24");
                return;
            }

            double speed = CmbPlaybackSpeed?.SelectedIndex switch
            {
                0 => 0.5,
                1 => 1.0,
                2 => 1.25,
                3 => 1.5,
                4 => 2.0,
                5 => 3.0,
                _ => 1.0
            };

            int loops = CmbLoopCount?.SelectedIndex switch
            {
                0 => 1,
                1 => 2,
                2 => 3,
                3 => 5,
                4 => 10,
                5 => 0, // Infinite
                _ => 1
            };

            int countdown = (ChkPrepCountdown?.IsChecked == true) ? 3 : 0;

            Task.Run(async () =>
            {
                if (!_isTextManuallyEdited && _rawEvents.Count > 0)
                {
                    await _macroPlayer.PlayRawEventsAsync(_rawEvents, speed, loops, countdown);
                }
                else
                {
                    await _macroPlayer.PlayDualTrackAsync(dualTrack, speed, loops, countdown);
                }
            });
        }

        private void MacroPlayer_PlaybackStarted(object? sender, EventArgs e)
        {
            Dispatcher.InvokeAsync(() =>
            {
                BtnPlayMacroToggle.Style = (Style)FindResource("StopMacroButton");
                TxtPlayIcon.Text = "■";
                TxtPlayLabel.Text = "STOP PLAYING";

                BtnRecordToggle.IsEnabled = false;

                BorderStatusBadge.Background = new SolidColorBrush(Color.FromRgb(6, 78, 59));
                PulseIndicator.Fill = new SolidColorBrush(Color.FromRgb(16, 185, 129));
                TxtStatus.Text = "▶ PLAYING MACRO";
                TxtStatus.Foreground = new SolidColorBrush(Color.FromRgb(110, 231, 183));

                ShowToast("▶ Macro playback active! Press F8 to stop.", "#10B981");
                SoundFeedback.PlayStartSound();
            });
        }

        private void MacroPlayer_PlaybackStopped(object? sender, EventArgs e)
        {
            Dispatcher.InvokeAsync(() =>
            {
                BtnPlayMacroToggle.Style = (Style)FindResource("PlayMacroButton");
                TxtPlayIcon.Text = "▶";
                TxtPlayLabel.Text = "PLAY MACRO";

                BtnRecordToggle.IsEnabled = true;

                BorderStatusBadge.Background = new SolidColorBrush(Color.FromRgb(33, 38, 45));
                PulseIndicator.Fill = new SolidColorBrush(Color.FromRgb(139, 148, 158));
                TxtStatus.Text = "STANDBY";
                TxtStatus.Foreground = new SolidColorBrush(Color.FromRgb(139, 148, 158));

                TxtLiveEventFeedback.Text = "Playback finished. F4 = Record | F8 = Play Macro.";
                ShowToast("⏹️ Macro playback completed.", "#38BDF8");
                SoundFeedback.PlayStopSound();
            });
        }

        private void MacroPlayer_ProgressChanged(object? sender, PlaybackProgressEventArgs e)
        {
            Dispatcher.InvokeAsync(() =>
            {
                if (e.CountdownRemainingSeconds > 0)
                {
                    TxtLiveEventFeedback.Text = $"⏳ Starting in {e.CountdownRemainingSeconds}s... Switch to your target window now!";
                    TxtStatus.Text = $"COUNTDOWN: {e.CountdownRemainingSeconds}s";
                }
                else
                {
                    string loopStr = (e.TotalLoops > 0) ? $"Loop {e.CurrentLoop}/{e.TotalLoops}" : $"Loop {e.CurrentLoop} (Infinite)";
                    TxtLiveEventFeedback.Text = $"▶ {loopStr} | Step {e.CurrentStep}/{e.TotalSteps}: {e.CurrentInstruction}";
                    TxtStatus.Text = $"PLAYING ({e.CurrentStep}/{e.TotalSteps})";
                }
            });
        }

        #endregion

        #region Formatting & UI Updates

        private void Timer_Tick(object? sender, EventArgs e)
        {
            var elapsed = _recordingStopwatch.Elapsed;
            TxtTimer.Text = $"{elapsed.Minutes:00}:{elapsed.Seconds:00}.{elapsed.Milliseconds / 100:0}";
        }

        private FormattingOptions GetCurrentOptions()
        {
            string connector = " and ";
            if (CmbConnector != null)
            {
                connector = CmbConnector.SelectedIndex switch
                {
                    0 => " and ",
                    1 => " + ",
                    2 => " & ",
                    _ => " and "
                };
            }

            int chordTolerance = 45;
            if (TxtChordTolerance != null && int.TryParse(TxtChordTolerance.Text, out int parsedTolerance))
            {
                chordTolerance = Math.Clamp(parsedTolerance, 5, 500);
            }

            var options = new FormattingOptions
            {
                SmartChordGrouping = ChkSmartChords?.IsChecked == true,
                ChordStaggerToleranceMs = chordTolerance,
                MultiKeyConnector = connector,
                IncludeInitialDelay = ChkInitialDelay?.IsChecked == true,
                HoldTemplate = TxtTemplateHold?.Text ?? "hold {key} for {ms}ms",
                ReleaseTemplate = TxtTemplateRelease?.Text ?? "release for {ms}ms",
                Separator = TxtTemplateSeparator?.Text ?? ", "
            };

            if (CmbFormatPreset != null)
            {
                options.FormatMode = CmbFormatPreset.SelectedIndex switch
                {
                    0 => OutputFormatMode.CommaSeparatedInline,
                    1 => OutputFormatMode.LineByLine,
                    2 => OutputFormatMode.DetailedList,
                    _ => OutputFormatMode.CommaSeparatedInline
                };
            }

            return options;
        }

        private void UpdateFormatting()
        {
            if (TxtOutput == null) return;

            var options = GetCurrentOptions();
            var dualTrack = KeyInstructionFormatter.ParseDualTrackInstructions(_rawEvents, options);
            var formattedText = KeyInstructionFormatter.FormatToString(_rawEvents, options);

            _isUpdatingTextProgrammatically = true;
            TxtOutput.Text = formattedText;
            _isUpdatingTextProgrammatically = false;
            _isTextManuallyEdited = false;

            if (TxtStatsInfo != null)
            {
                if (dualTrack.HasSustainedKeys)
                {
                    TxtStatsInfo.Text = $"{dualTrack.SustainedInstructions.Count} held key, {dualTrack.QuickInstructions.Count} quick action(s)";
                }
                else
                {
                    TxtStatsInfo.Text = $"{dualTrack.QuickInstructions.Count} step{(dualTrack.QuickInstructions.Count == 1 ? "" : "s")} generated";
                }
            }
        }

        private void TxtOutput_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (_isUpdatingTextProgrammatically) return;

            _isTextManuallyEdited = true;

            var parsed = KeyInstructionFormatter.ParseDualTrackFromString(TxtOutput.Text);
            if (TxtStatsInfo != null)
            {
                TxtStatsInfo.Text = $"{parsed.TotalCount} step{(parsed.TotalCount == 1 ? "" : "s")} ready";
            }
        }

        #endregion

        #region Macro Library Management

        private void RefreshMacroList()
        {
            _savedMacros.Clear();
            var macros = _macroManager.GetAllMacros();
            foreach (var m in macros.OrderByDescending(x => x.CreatedAt))
            {
                _savedMacros.Add(m);
            }
        }

        private void BtnSaveMacroProfile_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(TxtOutput.Text))
            {
                ShowToast("⚠️ Cannot save an empty macro! Record or type instructions first.", "#FBBF24");
                return;
            }

            var parsed = KeyInstructionFormatter.ParseFromString(TxtOutput.Text);
            string defaultName = $"Macro {DateTime.Now:MM-dd HH:mm}";

            var profile = new MacroProfile
            {
                Name = defaultName,
                FormattedText = TxtOutput.Text,
                StepCount = parsed.Count,
                TotalDurationMs = parsed.Sum(p => p.DurationMs)
            };

            _macroManager.SaveMacro(profile);
            RefreshMacroList();
            ShowToast($"💾 Saved '{profile.Name}' to Macro Library!", "#34D399");
        }

        private void ListSavedMacros_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (ListSavedMacros.SelectedItem is MacroProfile selected)
            {
                TxtSelectedMacroTitle.Text = selected.Name;
                TxtSelectedMacroDetails.Text = $"Created: {selected.CreatedAt:yyyy-MM-dd HH:mm:ss} | Steps: {selected.StepCount} | Duration: {selected.TotalDurationMs}ms";
                TxtSelectedMacroPreview.Text = selected.FormattedText;
            }
            else
            {
                TxtSelectedMacroTitle.Text = "Select a macro to preview";
                TxtSelectedMacroDetails.Text = "No macro selected.";
                TxtSelectedMacroPreview.Text = string.Empty;
            }
        }

        private void BtnLoadToEditor_Click(object sender, RoutedEventArgs e)
        {
            if (ListSavedMacros.SelectedItem is MacroProfile selected)
            {
                _rawEvents.Clear();
                _observableEvents.Clear();

                _isUpdatingTextProgrammatically = true;
                TxtOutput.Text = selected.FormattedText;
                _isUpdatingTextProgrammatically = false;
                _isTextManuallyEdited = true;

                var parsed = KeyInstructionFormatter.ParseFromString(selected.FormattedText);
                if (TxtStatsInfo != null)
                {
                    TxtStatsInfo.Text = $"{parsed.Count} steps loaded";
                }

                ShowToast($"📥 Loaded '{selected.Name}' into active editor & player!", "#38BDF8");
            }
            else
            {
                ShowToast("⚠️ Please select a macro from the list first.", "#FBBF24");
            }
        }

        private void BtnDeleteMacro_Click(object sender, RoutedEventArgs e)
        {
            if (ListSavedMacros.SelectedItem is MacroProfile selected)
            {
                if (MessageBox.Show($"Are you sure you want to delete '{selected.Name}'?", "Confirm Delete", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
                {
                    _macroManager.DeleteMacro(selected);
                    RefreshMacroList();
                    ShowToast($"🗑️ Deleted macro '{selected.Name}'.", "#94A3B8");
                }
            }
        }

        private void BtnRefreshMacros_Click(object sender, RoutedEventArgs e)
        {
            RefreshMacroList();
            ShowToast("🔄 Macro list refreshed.", "#38BDF8");
        }

        #endregion

        #region UI Button Handlers & Settings

        private void BtnRecordToggle_Click(object sender, RoutedEventArgs e)
        {
            _hook.ToggleRecording();
        }

        private void BtnCopy_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(TxtOutput.Text))
            {
                ShowToast("⚠️ Output is empty. Record some keys first!", "#FBBF24");
                return;
            }

            try
            {
                Clipboard.SetText(TxtOutput.Text);
                ShowToast("📋 Copied instructions to clipboard!", "#38BDF8");
            }
            catch (Exception ex)
            {
                ShowToast($"Copy failed: {ex.Message}", "#F87171");
            }
        }

        private void BtnClear_Click(object sender, RoutedEventArgs e)
        {
            _rawEvents.Clear();
            _observableEvents.Clear();
            _isUpdatingTextProgrammatically = true;
            TxtOutput.Text = string.Empty;
            _isUpdatingTextProgrammatically = false;

            TxtEventCount.Text = "0 events";
            TxtTimer.Text = "00:00.0";
            TxtLiveEventFeedback.Text = "Cleared history. F4 = Record | F8 = Play Macro.";
            if (TxtStatsInfo != null)
            {
                TxtStatsInfo.Text = "0 steps generated";
            }
            ShowToast("🗑️ History cleared.", "#94A3B8");
        }

        private void ChkAlwaysOnTop_Changed(object sender, RoutedEventArgs e)
        {
            Topmost = ChkAlwaysOnTop.IsChecked == true;
        }

        private void ChkSoundFeedback_Changed(object sender, RoutedEventArgs e)
        {
            SoundFeedback.Enabled = ChkSoundFeedback.IsChecked == true;
        }

        private void CmbFormatPreset_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateFormatting();
        }

        private void CmbConnector_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            UpdateFormatting();
        }

        private void FormattingOption_Changed(object sender, RoutedEventArgs e)
        {
            UpdateFormatting();
        }

        private void Template_TextChanged(object sender, TextChangedEventArgs e)
        {
            UpdateFormatting();
        }

        private void BtnResetTemplates_Click(object sender, RoutedEventArgs e)
        {
            if (TxtTemplateHold != null) TxtTemplateHold.Text = "hold {key} for {ms}ms";
            if (TxtTemplateRelease != null) TxtTemplateRelease.Text = "release for {ms}ms";
            if (TxtTemplateSeparator != null) TxtTemplateSeparator.Text = ", ";
            if (TxtChordTolerance != null) TxtChordTolerance.Text = "45";
            if (CmbConnector != null) CmbConnector.SelectedIndex = 0;
            if (ChkSmartChords != null) ChkSmartChords.IsChecked = true;
            UpdateFormatting();
            ShowToast("Settings reset to default.", "#38BDF8");
        }

        private void BtnHelp_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "KeyRecorder & Macro Player Help:\n\n" +
                "1. [F4] RECORDING:\n" +
                "   • Press F4 anywhere to START recording keystrokes and multi-key holds.\n" +
                "   • Press F4 again to STOP recording.\n" +
                "   • Holding multiple keys simultaneously generates:\n" +
                "     'hold RightArrow and UpArrow for 350ms, release for 120ms...'\n\n" +
                "2. [F8] MACRO PLAYBACK:\n" +
                "   • Press F8 anywhere to PLAY the current macro.\n" +
                "   • Set Speed (0.5x to 3.0x), Repeat count (or Continuous loop), and 3s Focus Countdown.\n" +
                "   • Press F8 again to immediately STOP playback.\n\n" +
                "3. MACRO LIBRARY:\n" +
                "   • Save your favorite macros to the library, preview, and load them anytime!",
                "KeyRecorder Help",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }

        private void ShowToast(string message, string hexColor)
        {
            if (TxtToastMessage == null) return;
            try
            {
                TxtToastMessage.Text = message;
                TxtToastMessage.Foreground = (SolidColorBrush)new BrushConverter().ConvertFromString(hexColor)!;
            }
            catch
            {
                TxtToastMessage.Text = message;
            }
        }

        #endregion
    }
}
