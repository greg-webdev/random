using System;
using System.IO;
using System.Windows;
using KeyRecorder.Tests;

namespace KeyRecorder
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            if (e.Args.Length > 0 && e.Args[0] == "--test")
            {
                try
                {
                    FormatterTests.RunAllTests();
                    File.WriteAllText("test_results.log", "SUCCESS: All tests passed!");
                    Shutdown(0);
                    return;
                }
                catch (Exception ex)
                {
                    File.WriteAllText("test_results.log", $"FAILED: {ex.Message}\n{ex.StackTrace}");
                    Shutdown(1);
                    return;
                }
            }

            base.OnStartup(e);
        }
    }
}
