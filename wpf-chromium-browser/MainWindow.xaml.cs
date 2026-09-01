using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace WpfChromiumBrowser
{
    public partial class MainWindow : Window
    {
        private readonly List<BrowserTabItem> _tabs = new();
        private BrowserTabItem? _activeTab;
        private readonly HashSet<string> _bookmarks = new();
        private readonly string _assetsDir;

        public MainWindow()
        {
            InitializeComponent();
            _assetsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets");

            // Seed default bookmarks
            _bookmarks.Add("https://www.google.com");
            _bookmarks.Add("https://www.youtube.com");
            _bookmarks.Add("https://github.com");
            _bookmarks.Add("chrome://version");
            _bookmarks.Add("chrome://about");

            Loaded += MainWindow_Loaded;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await CreateNewTabAsync("chrome://newtab");
        }

        #region Tab Management

        private async Task<BrowserTabItem> CreateNewTabAsync(string initialUrl = "chrome://newtab", bool activate = true)
        {
            var tab = new BrowserTabItem
            {
                Url = initialUrl,
                DisplayUrl = initialUrl,
                Title = "New Tab"
            };

            var webView = new WebView2
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                VerticalAlignment = VerticalAlignment.Stretch,
                Visibility = Visibility.Collapsed
            };

            tab.WebView = webView;
            _tabs.Add(tab);
            WebViewsContainer.Children.Add(webView);

            // Create Tab Header UI
            var tabHeader = CreateTabHeaderControl(tab);
            int insertIndex = TabsPanel.Children.IndexOf(BtnNewTab);
            TabsPanel.Children.Insert(insertIndex >= 0 ? insertIndex : 0, tabHeader);

            // Attach WebView2 Events
            webView.NavigationStarting += (s, e) =>
            {
                tab.IsLoading = true;
                if (tab == _activeTab)
                {
                    ProgLoading.Visibility = Visibility.Visible;
                    ProgLoading.IsIndeterminate = true;
                    TxtReloadIcon.Text = "✕";
                }
            };

            webView.NavigationCompleted += (s, e) =>
            {
                tab.IsLoading = false;
                if (tab == _activeTab)
                {
                    ProgLoading.Visibility = Visibility.Collapsed;
                    ProgLoading.IsIndeterminate = false;
                    TxtReloadIcon.Text = "⟳";
                    UpdateNavButtons();
                    UpdateStarState();
                }
            };

            webView.SourceChanged += (s, e) =>
            {
                if (webView.Source != null)
                {
                    string realUrl = webView.Source.ToString();
                    tab.Url = realUrl;
                    if (!tab.DisplayUrl.StartsWith("chrome://") || !realUrl.StartsWith("file://"))
                    {
                        tab.DisplayUrl = realUrl;
                    }
                    if (tab == _activeTab)
                    {
                        UpdateOmniboxUI();
                        UpdateNavButtons();
                        UpdateStarState();
                    }
                }
            };

            // Initialize WebView2 Core Engine
            await webView.EnsureCoreWebView2Async();

            webView.CoreWebView2.DocumentTitleChanged += (s, e) =>
            {
                string title = webView.CoreWebView2.DocumentTitle;
                if (!string.IsNullOrWhiteSpace(title))
                {
                    tab.Title = title;
                    if (tab == _activeTab)
                    {
                        Title = $"{title} - Chromium Browser";
                    }
                }
            };

            webView.CoreWebView2.NewWindowRequested += (s, e) =>
            {
                e.Handled = true;
                _ = CreateNewTabAsync(e.Uri, true);
            };

            // Navigate initial URL
            NavigateTab(tab, initialUrl);

            if (activate)
            {
                SelectTab(tab);
            }

            return tab;
        }

        private Border CreateTabHeaderControl(BrowserTabItem tab)
        {
            var border = new Border
            {
                Background = (Brush)FindResource("BgPrimary"),
                CornerRadius = new CornerRadius(6, 6, 0, 0),
                Height = 32,
                MinWidth = 120,
                MaxWidth = 200,
                Margin = new Thickness(2, 0, 2, 0),
                Cursor = Cursors.Hand,
                Tag = tab
            };

            var grid = new Grid { Margin = new Thickness(8, 0, 4, 0) };
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(16) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(20) });

            var icon = new TextBlock
            {
                Text = "🌐",
                FontSize = 11,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(icon, 0);

            var titleBlock = new TextBlock
            {
                Text = tab.Title,
                Foreground = (Brush)FindResource("TextSecondary"),
                FontSize = 12,
                TextTrimming = TextTrimming.CharacterEllipsis,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(6, 0, 4, 0)
            };
            Grid.SetColumn(titleBlock, 1);

            // Bind title change
            tab.PropertyChanged += (s, e) =>
            {
                if (e.PropertyName == nameof(BrowserTabItem.Title))
                {
                    Dispatcher.Invoke(() => titleBlock.Text = tab.Title);
                }
            };

            var closeBtn = new Button
            {
                Content = "✕",
                FontSize = 10,
                Width = 16,
                Height = 16,
                Style = (Style)FindResource("NavButtonStyle"),
                Foreground = (Brush)FindResource("TextSecondary"),
                VerticalAlignment = VerticalAlignment.Center,
                ToolTip = "Close tab"
            };
            Grid.SetColumn(closeBtn, 2);

            closeBtn.Click += (s, e) =>
            {
                e.Handled = true;
                CloseTab(tab);
            };

            grid.Children.Add(icon);
            grid.Children.Add(titleBlock);
            grid.Children.Add(closeBtn);
            border.Child = grid;

            border.MouseLeftButtonDown += (s, e) => SelectTab(tab);
            border.MouseDown += (s, e) =>
            {
                if (e.MiddleButton == MouseButtonState.Pressed)
                {
                    CloseTab(tab);
                }
            };

            return border;
        }

        private void SelectTab(BrowserTabItem tab)
        {
            _activeTab = tab;

            // Update Tab Headers visual states
            foreach (var child in TabsPanel.Children)
            {
                if (child is Border b && b.Tag is BrowserTabItem t)
                {
                    bool isActive = t == tab;
                    b.Background = (Brush)FindResource(isActive ? "BgSecondary" : "BgPrimary");
                    if (b.Child is Grid g && g.Children[1] is TextBlock tb)
                    {
                        tb.Foreground = (Brush)FindResource(isActive ? "TextPrimary" : "TextSecondary");
                        tb.FontWeight = isActive ? FontWeights.SemiBold : FontWeights.Normal;
                    }
                }
            }

            // Update WebViews visibility
            foreach (var t in _tabs)
            {
                t.WebView.Visibility = (t == tab) ? Visibility.Visible : Visibility.Collapsed;
            }

            Title = $"{tab.Title} - Chromium Browser";
            UpdateOmniboxUI();
            UpdateNavButtons();
            UpdateStarState();
        }

        private void CloseTab(BrowserTabItem tab)
        {
            int index = _tabs.IndexOf(tab);
            if (index == -1) return;

            // Remove Header UI
            Border? targetHeader = null;
            foreach (var child in TabsPanel.Children)
            {
                if (child is Border b && b.Tag == tab)
                {
                    targetHeader = b;
                    break;
                }
            }
            if (targetHeader != null)
            {
                TabsPanel.Children.Remove(targetHeader);
            }

            // Remove and dispose WebView
            WebViewsContainer.Children.Remove(tab.WebView);
            tab.WebView.Dispose();
            _tabs.Remove(tab);

            if (_tabs.Count == 0)
            {
                _ = CreateNewTabAsync("chrome://newtab");
            }
            else if (_activeTab == tab)
            {
                int nextIndex = Math.Max(0, index - 1);
                SelectTab(_tabs[nextIndex]);
            }
        }

        #endregion

        #region Navigation & URL Resolution

        private string ResolveUrl(string input)
        {
            string trimmed = input?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(trimmed)) return ResolveChromeUrl("newtab");

            // Handle internal chrome:// schemes
            if (trimmed.StartsWith("chrome://", StringComparison.OrdinalIgnoreCase))
            {
                string page = trimmed.Substring(9).Trim('/').ToLower();
                return ResolveChromeUrl(page);
            }

            // Handle edge:// schemes directly supported by WebView2
            if (trimmed.StartsWith("edge://", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
            {
                return trimmed;
            }

            // Localhost or IP address
            if (Regex.IsMatch(trimmed, @"^(localhost(:\d+)?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?)(\/.*)?$", RegexOptions.IgnoreCase))
            {
                return "http://" + trimmed;
            }

            // Standard Domain name (e.g. example.com, github.com)
            if (Regex.IsMatch(trimmed, @"^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(\/.*)?$") && !trimmed.Contains(' '))
            {
                return "https://" + trimmed;
            }

            // Fallback Search query (Google)
            return $"https://www.google.com/search?q={Uri.EscapeDataString(trimmed)}";
        }

        private string ResolveChromeUrl(string pageName)
        {
            string clean = pageName.Split('?')[0].Split('/')[0].ToLower();
            string fileName = clean switch
            {
                "newtab" or "new-tab" or "" => "newtab.html",
                "version" or "help" => "version.html",
                "about" or "urls" or "chrome-urls" => "urls.html",
                "history" => "history.html",
                "bookmarks" => "bookmarks.html",
                "downloads" => "downloads.html",
                "settings" or "flags" => "settings.html",
                "dino" => "dino.html",
                _ => "urls.html"
            };

            string localPath = Path.Combine(_assetsDir, fileName);
            if (File.Exists(localPath))
            {
                return new Uri(localPath).AbsoluteUri;
            }
            return "https://www.google.com";
        }

        private void NavigateTab(BrowserTabItem tab, string targetInput)
        {
            tab.DisplayUrl = targetInput;
            string targetUrl = ResolveUrl(targetInput);

            if (tab.WebView.CoreWebView2 != null)
            {
                tab.WebView.CoreWebView2.Navigate(targetUrl);
            }
            else
            {
                tab.WebView.Source = new Uri(targetUrl);
            }

            if (tab == _activeTab)
            {
                UpdateOmniboxUI();
            }
        }

        private void UpdateOmniboxUI()
        {
            if (_activeTab == null) return;
            string display = _activeTab.DisplayUrl;

            if (display.Equals("chrome://newtab", StringComparison.OrdinalIgnoreCase))
            {
                TxtOmnibox.Text = string.Empty;
                TxtSecurityBadge.Text = "⚡";
                TxtSecurityBadge.ToolTip = "Chromium Start Page";
            }
            else
            {
                TxtOmnibox.Text = display;
                if (display.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    TxtSecurityBadge.Text = "🔒";
                    TxtSecurityBadge.Foreground = (Brush)FindResource("AccentCyan");
                    TxtSecurityBadge.ToolTip = "Secure HTTPS Connection";
                }
                else if (display.StartsWith("chrome://", StringComparison.OrdinalIgnoreCase))
                {
                    TxtSecurityBadge.Text = "⚡";
                    TxtSecurityBadge.Foreground = (Brush)FindResource("AccentCyan");
                    TxtSecurityBadge.ToolTip = "Internal Chromium Protocol";
                }
                else
                {
                    TxtSecurityBadge.Text = "ℹ";
                    TxtSecurityBadge.Foreground = (Brush)FindResource("TextSecondary");
                    TxtSecurityBadge.ToolTip = "Standard Connection";
                }
            }
        }

        private void UpdateNavButtons()
        {
            if (_activeTab?.WebView != null)
            {
                BtnBack.IsEnabled = _activeTab.WebView.CanGoBack;
                BtnForward.IsEnabled = _activeTab.WebView.CanGoForward;
            }
        }

        private void UpdateStarState()
        {
            if (_activeTab == null) return;
            bool isBookmarked = _bookmarks.Contains(_activeTab.DisplayUrl) || _bookmarks.Contains(_activeTab.Url);
            TxtStarIcon.Text = isBookmarked ? "★" : "☆";
            TxtStarIcon.Foreground = isBookmarked ? new SolidColorBrush(Color.FromRgb(245, 158, 11)) : (Brush)FindResource("TextSecondary");
        }

        #endregion

        #region Event Handlers & Window Controls

        private void BtnNewTab_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://newtab");

        private void BtnBack_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab?.WebView.CanGoBack == true) _activeTab.WebView.GoBack();
        }

        private void BtnForward_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab?.WebView.CanGoForward == true) _activeTab.WebView.GoForward();
        }

        private void BtnReload_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab == null) return;
            if (_activeTab.IsLoading)
            {
                _activeTab.WebView.Stop();
            }
            else
            {
                _activeTab.WebView.Reload();
            }
        }

        private void BtnHome_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab != null) NavigateTab(_activeTab, "chrome://newtab");
        }

        private void TxtOmnibox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter && _activeTab != null)
            {
                NavigateTab(_activeTab, TxtOmnibox.Text);
                WebViewsContainer.Focus();
            }
        }

        private void TxtOmnibox_GotFocus(object sender, RoutedEventArgs e) => TxtOmnibox.SelectAll();

        private void BtnStar_Click(object sender, RoutedEventArgs e)
        {
            if (_activeTab == null) return;
            string url = _activeTab.DisplayUrl;
            if (string.IsNullOrWhiteSpace(url) || url == "chrome://newtab") return;

            if (_bookmarks.Contains(url))
            {
                _bookmarks.Remove(url);
            }
            else
            {
                _bookmarks.Add(url);
            }
            UpdateStarState();
        }

        private void BtnDevTools_Click(object sender, RoutedEventArgs e)
        {
            _activeTab?.WebView.CoreWebView2?.OpenDevToolsWindow();
        }

        private void BtnMenu_Click(object sender, RoutedEventArgs e)
        {
            if (BtnMenu.ContextMenu != null)
            {
                BtnMenu.ContextMenu.PlacementTarget = BtnMenu;
                BtnMenu.ContextMenu.IsOpen = true;
            }
        }

        private void QuickBm_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button b && b.Tag is string url && _activeTab != null)
            {
                NavigateTab(_activeTab, url);
            }
        }

        private void MenuNewTab_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://newtab");
        private void MenuDevTools_Click(object sender, RoutedEventArgs e) => _activeTab?.WebView.CoreWebView2?.OpenDevToolsWindow();
        private void MenuHistory_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://history");
        private void MenuBookmarks_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://bookmarks");
        private void MenuDownloads_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://downloads");
        private void MenuUrls_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://about");
        private void MenuVersion_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://version");
        private void MenuDino_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://dino");
        private void MenuSettings_Click(object sender, RoutedEventArgs e) => _ = CreateNewTabAsync("chrome://settings");
        private void MenuExit_Click(object sender, RoutedEventArgs e) => Close();

        private void BtnMinimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
        private void BtnMaximize_Click(object sender, RoutedEventArgs e)
        {
            if (WindowState == WindowState.Maximized)
            {
                WindowState = WindowState.Normal;
                TxtMaxIcon.Text = "▢";
            }
            else
            {
                WindowState = WindowState.Maximized;
                TxtMaxIcon.Text = "❐";
            }
        }
        private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

        private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            // Ctrl+T: New tab
            if (e.Key == Key.T && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
            {
                e.Handled = true;
                _ = CreateNewTabAsync("chrome://newtab");
            }
            // Ctrl+W: Close tab
            else if (e.Key == Key.W && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
            {
                e.Handled = true;
                if (_activeTab != null) CloseTab(_activeTab);
            }
            // Ctrl+L or Alt+D: Focus Omnibox
            else if ((e.Key == Key.L && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control) ||
                     (e.Key == Key.D && (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt))
            {
                e.Handled = true;
                TxtOmnibox.Focus();
                TxtOmnibox.SelectAll();
            }
            // Ctrl+R or F5: Reload
            else if ((e.Key == Key.R && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control) || e.Key == Key.F5)
            {
                e.Handled = true;
                _activeTab?.WebView.Reload();
            }
            // F12: DevTools
            else if (e.Key == Key.F12)
            {
                e.Handled = true;
                _activeTab?.WebView.CoreWebView2?.OpenDevToolsWindow();
            }
            // Ctrl+Tab: Switch Tab
            else if (e.Key == Key.Tab && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
            {
                e.Handled = true;
                if (_tabs.Count > 1 && _activeTab != null)
                {
                    int index = _tabs.IndexOf(_activeTab);
                    int next = (index + 1) % _tabs.Count;
                    SelectTab(_tabs[next]);
                }
            }
        }

        #endregion
    }
}