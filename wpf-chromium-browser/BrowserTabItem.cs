using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.Web.WebView2.Wpf;

namespace WpfChromiumBrowser
{
    public class BrowserTabItem : INotifyPropertyChanged
    {
        private string _title = "New Tab";
        private string _url = "chrome://newtab";
        private string _displayUrl = "chrome://newtab";
        private bool _isLoading;
        private bool _canGoBack;
        private bool _canGoForward;
        private bool _isSecure;

        public string Id { get; } = Guid.NewGuid().ToString("N");

        public string Title
        {
            get => _title;
            set { _title = value; OnPropertyChanged(); }
        }

        public string Url
        {
            get => _url;
            set { _url = value; OnPropertyChanged(); }
        }

        public string DisplayUrl
        {
            get => _displayUrl;
            set { _displayUrl = value; OnPropertyChanged(); }
        }

        public bool IsLoading
        {
            get => _isLoading;
            set { _isLoading = value; OnPropertyChanged(); }
        }

        public bool CanGoBack
        {
            get => _canGoBack;
            set { _canGoBack = value; OnPropertyChanged(); }
        }

        public bool CanGoForward
        {
            get => _canGoForward;
            set { _canGoForward = value; OnPropertyChanged(); }
        }

        public bool IsSecure
        {
            get => _isSecure;
            set { _isSecure = value; OnPropertyChanged(); }
        }

        public WebView2 WebView { get; set; } = null!;

        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string? name = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
        }
    }
}
