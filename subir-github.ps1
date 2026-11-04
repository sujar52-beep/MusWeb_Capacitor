
# ==========================================================
# MUSWEB - SUBIR CAMBIOS A GITHUB
# Rama: mejoras-movil
# ==========================================================

$ErrorActionPreference = "Stop"
$Rama = "mejoras-movil"

function Ejecutar-Git {
    param([string[]]$Argumentos)

    & git @Argumentos

    if ($LASTEXITCODE -ne 0) {
        throw "Error ejecutando git $($Argumentos -join ' ')"
    }
}

try {
    Set-Location $PSScriptRoot

    Write-Host "`n====================================" -ForegroundColor Cyan
    Write-Host "       MUSWEB - SUBIR A GITHUB" -ForegroundColor Cyan
    Write-Host "====================================`n" -ForegroundColor Cyan

    # 1. Comprobar Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git no está instalado o no está disponible."
    }

    $raiz = (& git rev-parse --show-toplevel).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw "Esta carpeta no es un repositorio Git."
    }

    # 2. Comprobar rama
    $ramaActual = (& git branch --show-current).Trim()

    if ($ramaActual -ne $Rama) {
        throw "Estás en la rama '$ramaActual'. Cambia a '$Rama' antes de continuar."
    }

    Write-Host "Rama correcta: $ramaActual" -ForegroundColor Green

    # 3. Comprobar conexión con GitHub
    Ejecutar-Git -Argumentos @("fetch", "origin")

    & git show-ref --verify --quiet "refs/remotes/origin/$Rama"

    if ($LASTEXITCODE -ne 0) {
        throw "No encuentro la rama origin/$Rama en GitHub."
    }

    # 4. Comprobar si GitHub tiene cambios que faltan aquí
    $diferencias = (& git rev-list --left-right --count "HEAD...origin/$Rama").Trim() -split '\s+'

    $adelante = [int]$diferencias[0]
    $atras = [int]$diferencias[1]

    if ($atras -gt 0) {
        throw "GitHub tiene $atras commit(s) que no tienes localmente. Hay que sincronizar antes de subir."
    }

    # 5. Mostrar cambios
    Write-Host "`nArchivos modificados:" -ForegroundColor Yellow
    & git status --short

    # 6. Preparar cambios
    Ejecutar-Git -Argumentos @("add", "-A")

    $hayCambios = (& git diff --cached --quiet)
    $resultadoDiff = $LASTEXITCODE

    if ($resultadoDiff -gt 1) {
        throw "No se pudieron comprobar los cambios preparados."
    }

    if ($resultadoDiff -eq 1) {
        Write-Host "`nCambios que se van a incluir:" -ForegroundColor Yellow
        & git diff --cached --stat

        Write-Host "`nSe incluirán todos los cambios de esta carpeta." -ForegroundColor Yellow
        $confirmar = Read-Host "¿Quieres continuar? (S/N)"

        if ($confirmar -notmatch '^[Ss]$') {
            Ejecutar-Git -Argumentos @("reset")
            Write-Host "Operación cancelada. No se ha creado ningún commit." -ForegroundColor Yellow
            exit
        }

        # 7. Crear commit
        $mensaje = Read-Host "`nEscribe el mensaje del commit"

        if ([string]::IsNullOrWhiteSpace($mensaje)) {
            $mensaje = "Actualizacion MusWeb $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        }

        Ejecutar-Git -Argumentos @("commit", "-m", $mensaje)
    }
    else {
        Write-Host "`nNo hay cambios nuevos para crear un commit." -ForegroundColor Yellow
    }

    # 8. Subir a GitHub
    Write-Host "`nSubiendo cambios a GitHub..." -ForegroundColor Cyan

    Ejecutar-Git -Argumentos @("push", "-u", "origin", $Rama)

    # 9. Resultado final
    Write-Host "`n====================================" -ForegroundColor Green
    Write-Host "       PROCESO COMPLETADO" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green

    Write-Host "Rama: $Rama" -ForegroundColor Green
    Write-Host "Repositorio: origin" -ForegroundColor Green

    Write-Host "`nEstado final:"
    Ejecutar-Git -Argumentos @("status")

}
catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "No se ha continuado con la subida." -ForegroundColor Red
}

Write-Host "`nPulsa INTRO para cerrar."
Read-Host
