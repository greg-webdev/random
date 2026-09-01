using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using OreFinder.Models;
using OreFinder.Services;

namespace OreFinder.ViewModels
{
    public class RelayCommand : ICommand
    {
        private readonly Action<object?> _execute;
        private readonly Predicate<object?>? _canExecute;

        public RelayCommand(Action<object?> execute, Predicate<object?>? canExecute = null)
        {
            _execute = execute ?? throw new ArgumentNullException(nameof(execute));
            _canExecute = canExecute;
        }

        public bool CanExecute(object? parameter) => _canExecute == null || _canExecute(parameter);
        public void Execute(object? parameter) => _execute(parameter);
        public event EventHandler? CanExecuteChanged
        {
            add => CommandManager.RequerySuggested += value;
            remove => CommandManager.RequerySuggested -= value;
        }
    }

    public class MainViewModel : INotifyPropertyChanged
    {
        private readonly WorldGeneratorService _generatorService;
        private CancellationTokenSource? _cts;

        private string _seed = "12345";
        private string _version = "1.8";
        private int _spawnX = 0;
        private int _spawnY = 64;
        private int _spawnZ = 0;
        private int _chunkRadius = 16;
        private string _selectedFilter = "All Ores";
        private bool _isScanning = false;
        private double _progress = 0;
        private string _statusMessage = "Ready. Enter a seed and click 'Find Ores'.";
        private WorldSummary? _summary;
        private OreLocation? _selectedOre;
        private string _searchFilterText = string.Empty;

        private List<OreLocation> _allFoundOres = new();
        public ObservableCollection<OreLocation> FilteredOres { get; } = new();

        public event PropertyChangedEventHandler? PropertyChanged;

        public string Seed
        {
            get => _seed;
            set { _seed = value; OnPropertyChanged(); }
        }

        public string Version
        {
            get => _version;
            set { _version = value; OnPropertyChanged(); }
        }

        public int SpawnX
        {
            get => _spawnX;
            set { _spawnX = value; OnPropertyChanged(); }
        }

        public int SpawnY
        {
            get => _spawnY;
            set { _spawnY = value; OnPropertyChanged(); }
        }

        public int SpawnZ
        {
            get => _spawnZ;
            set { _spawnZ = value; OnPropertyChanged(); }
        }

        public int ChunkRadius
        {
            get => _chunkRadius;
            set { _chunkRadius = value; OnPropertyChanged(); OnPropertyChanged(nameof(BlockRadiusText)); }
        }

        public string BlockRadiusText => $"±{_chunkRadius * 16} blocks ({_chunkRadius * 2 + 1}x{_chunkRadius * 2 + 1} chunks)";

        public string SelectedFilter
        {
            get => _selectedFilter;
            set
            {
                _selectedFilter = value;
                OnPropertyChanged();
                ApplyLocalFilter();
            }
        }

        public string SearchFilterText
        {
            get => _searchFilterText;
            set
            {
                _searchFilterText = value;
                OnPropertyChanged();
                ApplyLocalFilter();
            }
        }

        public bool IsScanning
        {
            get => _isScanning;
            set
            {
                _isScanning = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(CanScan));
            }
        }

        public bool CanScan => !IsScanning;

        public double Progress
        {
            get => _progress;
            set { _progress = value; OnPropertyChanged(); }
        }

        public string StatusMessage
        {
            get => _statusMessage;
            set { _statusMessage = value; OnPropertyChanged(); }
        }

        public WorldSummary? Summary
        {
            get => _summary;
            set { _summary = value; OnPropertyChanged(); }
        }

        public OreLocation? SelectedOre
        {
            get => _selectedOre;
            set { _selectedOre = value; OnPropertyChanged(); }
        }

        public List<string> AvailableVersions { get; } = new() { "1.8", "1.12", "1.7" };
        public List<int> AvailableRadii { get; } = new() { 8, 12, 16, 24, 32, 48 };
        public List<string> AvailableFilters { get; } = new() { "All Ores", "Diamond", "Gold", "Iron", "Redstone", "Lapis", "Coal" };

        public ICommand FindOresCommand { get; }
        public ICommand CancelCommand { get; }
        public ICommand RandomSeedCommand { get; }
        public ICommand CopyTpCommand { get; }
        public ICommand CopyCoordsCommand { get; }
        public ICommand SelectPresetSeedCommand { get; }

        public MainViewModel()
        {
            _generatorService = new WorldGeneratorService();

            FindOresCommand = new RelayCommand(async _ => await StartFindOresAsync(), _ => CanScan);
            CancelCommand = new RelayCommand(_ => CancelScan(), _ => IsScanning);
            RandomSeedCommand = new RelayCommand(_ => GenerateRandomSeed());
            CopyTpCommand = new RelayCommand(param => CopyToClipboard(param as string ?? SelectedOre?.TpCommand));
            CopyCoordsCommand = new RelayCommand(param => CopyToClipboard(param as string ?? SelectedOre?.CoordsDisplay));
            SelectPresetSeedCommand = new RelayCommand(param => SetPresetSeed(param as string));
        }

        private async Task StartFindOresAsync()
        {
            if (string.IsNullOrWhiteSpace(Seed))
            {
                StatusMessage = "Please enter a valid seed.";
                return;
            }

            IsScanning = true;
            Progress = 0;
            StatusMessage = $"Scanning Minecraft {Version} world (Seed: {Seed}) around ({SpawnX}, {SpawnY}, {SpawnZ})...";
            FilteredOres.Clear();
            _allFoundOres.Clear();

            _cts = new CancellationTokenSource();
            var progressReporter = new Progress<double>(p => Progress = p);

            try
            {
                OreType? filter = SelectedFilter switch
                {
                    "Diamond" => OreType.Diamond,
                    "Gold" => OreType.Gold,
                    "Iron" => OreType.Iron,
                    "Redstone" => OreType.Redstone,
                    "Lapis" => OreType.Lapis,
                    "Coal" => OreType.Coal,
                    _ => null
                };

                var (ores, summary) = await _generatorService.FindOresAsync(
                    Seed,
                    Version,
                    ChunkRadius,
                    SpawnX,
                    SpawnY,
                    SpawnZ,
                    filter,
                    progressReporter,
                    _cts.Token
                );

                _allFoundOres = ores;
                Summary = summary;

                ApplyLocalFilter();

                var closestDiamond = summary.ClosestDiamond;
                string diamondInfo = closestDiamond != null
                    ? $"Nearest Diamond: ({closestDiamond.X}, {closestDiamond.Y}, {closestDiamond.Z}) at {closestDiamond.Distance:F1} blocks ({closestDiamond.Direction})"
                    : "No diamonds in search radius.";

                StatusMessage = $"Scan Complete! Found {summary.TotalVeinsFound:N0} veins ({summary.TotalBlocksFound:N0} blocks) across {summary.TotalChunksScanned:N0} chunks in {summary.ExecutionTimeMs:F1} ms. {diamondInfo}";
            }
            catch (OperationCanceledException)
            {
                StatusMessage = "Scan cancelled by user.";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error during scan: {ex.Message}";
            }
            finally
            {
                IsScanning = false;
                _cts?.Dispose();
                _cts = null;
            }
        }

        private void CancelScan()
        {
            _cts?.Cancel();
        }

        private void GenerateRandomSeed()
        {
            var rand = new Random();
            long seed = ((long)rand.Next() << 32) | (uint)rand.Next();
            Seed = seed.ToString();
        }

        private void SetPresetSeed(string? preset)
        {
            if (preset == null) return;
            Seed = preset;
        }

        private void CopyToClipboard(string? text)
        {
            if (!string.IsNullOrWhiteSpace(text))
            {
                try
                {
                    Clipboard.SetText(text);
                    StatusMessage = $"Copied to clipboard: {text}";
                }
                catch
                {
                    // Clipboard access retry
                }
            }
        }

        private void ApplyLocalFilter()
        {
            FilteredOres.Clear();

            var query = _allFoundOres.AsEnumerable();

            if (SelectedFilter != "All Ores" && Enum.TryParse<OreType>(SelectedFilter, out var oreType))
            {
                query = query.Where(o => o.Type == oreType);
            }

            if (!string.IsNullOrWhiteSpace(SearchFilterText))
            {
                string search = SearchFilterText.Trim().ToLowerInvariant();
                query = query.Where(o =>
                    o.OreName.ToLowerInvariant().Contains(search) ||
                    o.X.ToString().Contains(search) ||
                    o.Y.ToString().Contains(search) ||
                    o.Z.ToString().Contains(search) ||
                    o.Direction.ToLowerInvariant().Contains(search));
            }

            foreach (var ore in query.Take(1000))
            {
                FilteredOres.Add(ore);
            }
        }

        protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}