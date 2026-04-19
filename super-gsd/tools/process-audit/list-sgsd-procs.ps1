Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
    Select-Object ProcessId,
        @{N='CPUs';E={[math]::Round($_.KernelModeTime/10000000 + $_.UserModeTime/10000000,1)}},
        @{N='MemMB';E={[math]::Round($_.WorkingSetSize/1MB,1)}},
        @{N='Start';E={
            try { ([Management.ManagementDateTimeConverter]::ToDateTime($_.CreationDate)).ToString('HH:mm:ss') }
            catch { '?' }
        }},
        CommandLine |
    Sort-Object Start |
    Format-Table -Wrap -AutoSize
