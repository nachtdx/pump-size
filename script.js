// Pump Sizing Calculator - Algoritma dari Pompa (1).xlsx
// Densitas & Viskositas langsung diinput

let currentResults = null;

// Standard motor HP (NEMA)
const standardMotorHP = [0.125, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500];

function getStandardMotor(requiredHP) {
    for (let std of standardMotorHP) {
        if (std >= requiredHP) return std;
    }
    return requiredHP;
}

// Calculate equivalent length from fittings
function calculateFittingLoss(side, D_m) {
    let totalLe = 0;
    if (side === 'suction') {
        document.querySelectorAll('.suction-fitting').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            let le_per_d = parseFloat(inp.dataset.le) || 0;
            totalLe += qty * le_per_d * D_m;
        });
        document.querySelectorAll('.suction-fitting-k').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            let k = parseFloat(inp.dataset.k) || 0;
            // Konversi K ke Le/D: Le/D = K / f, asumsi f = 0.02
            totalLe += qty * (k / 0.02) * D_m;
        });
    } else {
        document.querySelectorAll('.discharge-fitting').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            let le_per_d = parseFloat(inp.dataset.le) || 0;
            totalLe += qty * le_per_d * D_m;
        });
        document.querySelectorAll('.discharge-fitting-k').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            let k = parseFloat(inp.dataset.k) || 0;
            totalLe += qty * (k / 0.02) * D_m;
        });
    }
    return totalLe;
}

function getFittingDetails(side) {
    const details = [];
    if (side === 'suction') {
        document.querySelectorAll('.suction-fitting').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            if (qty > 0) details.push({ name: inp.dataset.name, qty: qty, le_per_d: parseFloat(inp.dataset.le) });
        });
        document.querySelectorAll('.suction-fitting-k').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            if (qty > 0) details.push({ name: inp.dataset.name, qty: qty, k: parseFloat(inp.dataset.k) });
        });
    } else {
        document.querySelectorAll('.discharge-fitting').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            if (qty > 0) details.push({ name: inp.dataset.name, qty: qty, le_per_d: parseFloat(inp.dataset.le) });
        });
        document.querySelectorAll('.discharge-fitting-k').forEach(inp => {
            let qty = parseFloat(inp.value) || 0;
            if (qty > 0) details.push({ name: inp.dataset.name, qty: qty, k: parseFloat(inp.dataset.k) });
        });
    }
    return details;
}

function calculatePump() {
    // --- Ambil Input ---
    const flowrate_m3h = parseFloat(document.getElementById('flowrate').value);
    const density = parseFloat(document.getElementById('density').value);
    const viscosity_cp = parseFloat(document.getElementById('viscosity').value);
    const vaporPressure_psi = parseFloat(document.getElementById('vaporPressure').value);
    const pumpEff = parseFloat(document.getElementById('pumpEfficiency').value) / 100;
    
    // Suction
    const suctionOpPress_atm = parseFloat(document.getElementById('suctionOpPress').value);
    const suctionStaticHead_m = parseFloat(document.getElementById('suctionStaticHead').value);
    const suctionEqLoss_psi = parseFloat(document.getElementById('suctionEqLoss').value);
    const suctionLength_m = parseFloat(document.getElementById('suctionLength').value);
    const suctionPipe = document.getElementById('suctionPipe').value.split(',');
    const suctionNPS = suctionPipe[0];
    const suctionID_in = parseFloat(suctionPipe[1]);
    
    // Discharge
    const dischargeOpPress_atm = parseFloat(document.getElementById('dischargeOpPress').value);
    const dischargeStaticHead_m = parseFloat(document.getElementById('dischargeStaticHead').value);
    const dischargeEqLoss_psi = parseFloat(document.getElementById('dischargeEqLoss').value);
    const dischargeLength_m = parseFloat(document.getElementById('dischargeLength').value);
    const dischargePipe = document.getElementById('dischargePipe').value.split(',');
    const dischargeNPS = dischargePipe[0];
    const dischargeID_in = parseFloat(dischargePipe[1]);
    
    // Motor
    const motorType = document.getElementById('motorType').value;
    const motorPoles = parseInt(document.getElementById('motorPoles').value);
    const slip = parseFloat(document.getElementById('slip').value) / 100;
    
    // --- Konversi Satuan ---
    const flowrate_m3s = flowrate_m3h / 3600;
    const suctionID_m = suctionID_in * 0.0254;
    const dischargeID_m = dischargeID_in * 0.0254;
    
    // --- Velocity ---
    const A_suction = Math.PI * Math.pow(suctionID_m, 2) / 4;
    const A_discharge = Math.PI * Math.pow(dischargeID_m, 2) / 4;
    const v_suction = flowrate_m3s / A_suction;
    const v_discharge = flowrate_m3s / A_discharge;
    const v = v_suction; // untuk perhitungan head velocity
    
    // --- Reynolds Number ---
    const viscosity_kgms = viscosity_cp * 0.001;
    const Re = (density * v_suction * suctionID_m) / viscosity_kgms;
    
    // --- Friction Factor (Colebrook approximation) ---
    let f = 0.02;
    if (Re < 2000) {
        f = 64 / Re;
    } else {
        const eps = 0.000045; // roughness untuk carbon steel (m)
        const rough = eps / suctionID_m;
        // Swamee-Jain
        f = 0.0055 * (1 + Math.pow(20000 * rough + 1e6 / Re, 1/3));
        f = Math.max(0.008, Math.min(0.05, f));
    }
    
    // --- Friction Loss Pipa Lurus (Darcy-Weisbach) ---
    // ΔP (Pa) = f * (L/D) * (ρ * v² / 2)
    const deltaP_per_m = f * (1 / suctionID_m) * (density * Math.pow(v_suction, 2) / 2);
    const suctionPipeLoss_Pa = deltaP_per_m * suctionLength_m;
    const dischargePipeLoss_Pa = deltaP_per_m * dischargeLength_m;
    
    // Konversi ke meter head
    const suctionPipeLoss_m = suctionPipeLoss_Pa / (density * 9.81);
    const dischargePipeLoss_m = dischargePipeLoss_Pa / (density * 9.81);
    
    // --- Fitting Loss (Equivalent Length) ---
    const suctionFittingLe_m = calculateFittingLoss('suction', suctionID_m);
    const dischargeFittingLe_m = calculateFittingLoss('discharge', dischargeID_m);
    
    const suctionFittingLoss_Pa = deltaP_per_m * suctionFittingLe_m;
    const dischargeFittingLoss_Pa = deltaP_per_m * dischargeFittingLe_m;
    
    const suctionFittingLoss_m = suctionFittingLoss_Pa / (density * 9.81);
    const dischargeFittingLoss_m = dischargeFittingLoss_Pa / (density * 9.81);
    
    // --- Pressure Head (ΔP / ρg) ---
    const P1_Pa = suctionOpPress_atm * 101325;
    const P2_Pa = dischargeOpPress_atm * 101325;
    const pressureHead_m = (P2_Pa - P1_Pa) / (density * 9.81);
    
    // --- Static Head ---
    const staticHead_m = dischargeStaticHead_m - suctionStaticHead_m;
    
    // --- Velocity Head ---
    const velocityHead_m = (Math.pow(v_discharge, 2) - Math.pow(v_suction, 2)) / (2 * 9.81);
    
    // --- Total Friction Head ---
    const frictionHead_m = suctionPipeLoss_m + dischargePipeLoss_m + suctionFittingLoss_m + dischargeFittingLoss_m;
    
    // --- Total Head Pompa (H) ---
    const totalHead_m = pressureHead_m + staticHead_m + velocityHead_m + frictionHead_m;
    const totalHead_ft = totalHead_m * 3.28084;
    
    // --- Hydraulic Power (kW & HP) ---
    // Ph (kW) = Q (m³/s) × H (m) × ρ (kg/m³) × g / 1000
    const Ph_kW = flowrate_m3s * totalHead_m * density * 9.81 / 1000;
    const Ph_HP = Ph_kW / 0.7457;
    
    // --- Shaft Power (Pump BHP) ---
    const pumpBHP = Ph_HP / pumpEff;
    
    // --- Motor Selection ---
    const motorRequired_HP = pumpBHP;
    const motorStandard_HP = getStandardMotor(motorRequired_HP);
    
    // --- Kecepatan Motor ---
    const f_hz = 50;
    const syncSpeed_rpm = 120 * f_hz / motorPoles;
    const actualSpeed_rpm = syncSpeed_rpm * (1 - slip);
    
    // --- Kecepatan Spesifik Pompa (Ns) ---
    const Q_m3s = flowrate_m3s;
    const Q_gpm = flowrate_m3h * 4.40287;
    const Ns_rpm = actualSpeed_rpm * Math.sqrt(Q_gpm) / Math.pow(totalHead_ft, 0.75);
    
    // --- NPSH Available ---
    // NPSHa = (P1 - Pv) / (ρg) + z1 - hf_suction
    const Pv_Pa = vaporPressure_psi * 6894.76;
    const npsha_m = ((P1_Pa - Pv_Pa) / (density * 9.81)) + suctionStaticHead_m - (suctionPipeLoss_m + suctionFittingLoss_m);
    
    // --- NPSH Required (estimasi berdasarkan Ns) ---
    let npshr_m = 0;
    if (Ns_rpm < 1000) npshr_m = 2;
    else if (Ns_rpm < 2000) npshr_m = 3 + (Ns_rpm - 1000) * 0.008;
    else if (Ns_rpm < 3000) npshr_m = 11 + (Ns_rpm - 2000) * 0.02;
    else npshr_m = 31;
    
    const cavitationStatus = npsha_m > npshr_m ? 'Aman (NPSHa > NPSHr)' : 'Warning: NPSHa < NPSHr';
    
    // --- Simpan Results ---
    currentResults = {
        project: {
            kodeAlat: document.getElementById('kodeAlat').value,
            pic: document.getElementById('pic').value,
            date: document.getElementById('calcDate').value,
            revision: document.getElementById('revision').value
        },
        fluid: { flowrate_m3h, flowrate_m3s, density, viscosity_cp, vaporPressure_psi, pumpEff: pumpEff * 100 },
        suction: {
            opPress_atm: suctionOpPress_atm, staticHead_m: suctionStaticHead_m, eqLoss_psi: suctionEqLoss_psi,
            length_m: suctionLength_m, pipeSize: suctionNPS, pipeID_in: suctionID_in, pipeID_m: suctionID_m,
            velocity_mps: v_suction, reynolds: Re, pipeLoss_m: suctionPipeLoss_m, fittingLoss_m: suctionFittingLoss_m,
            fittings: getFittingDetails('suction')
        },
        discharge: {
            opPress_atm: dischargeOpPress_atm, staticHead_m: dischargeStaticHead_m, eqLoss_psi: dischargeEqLoss_psi,
            length_m: dischargeLength_m, pipeSize: dischargeNPS, pipeID_in: dischargeID_in, pipeID_m: dischargeID_m,
            velocity_mps: v_discharge, pipeLoss_m: dischargePipeLoss_m, fittingLoss_m: dischargeFittingLoss_m,
            fittings: getFittingDetails('discharge')
        },
        headComponents: { pressureHead_m, staticHead_m, velocityHead_m, frictionHead_m, totalHead_m, totalHead_ft },
        power: { Ph_kW, Ph_HP, pumpBHP, motorRequired_HP, motorStandard_HP },
        motor: { motorType, motorPoles, syncSpeed_rpm, actualSpeed_rpm, slip: slip * 100 },
        npsh: { npsha_m, npshr_m, cavitationStatus, Ns: Ns_rpm },
        frictionFactor: f
    };
    
    displayResults();
    document.getElementById('exportBtn').disabled = false;
}

function displayResults() {
    const res = currentResults;
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('noResults').style.display = 'none';
    
    // --- Summary Grid ---
    document.getElementById('summaryGrid').innerHTML = `
        <div class="summary-item"><div class="summary-label">Kode Alat</div><div class="summary-value">${res.project.kodeAlat}</div><div class="summary-unit"></div></div>
        <div class="summary-item"><div class="summary-label">Flowrate</div><div class="summary-value">${res.fluid.flowrate_m3h.toFixed(2)}</div><div class="summary-unit">m³/jam</div></div>
        <div class="summary-item"><div class="summary-label">Total Head</div><div class="summary-value">${res.headComponents.totalHead_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">Total Head</div><div class="summary-value">${res.headComponents.totalHead_ft.toFixed(1)}</div><div class="summary-unit">ft</div></div>
        <div class="summary-item"><div class="summary-label">Hydraulic Power</div><div class="summary-value">${res.power.Ph_HP.toFixed(2)}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Pump BHP Required</div><div class="summary-value">${res.power.pumpBHP.toFixed(2)}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Motor Standar</div><div class="summary-value">${res.power.motorStandard_HP}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Efisiensi Pompa</div><div class="summary-value">${res.fluid.pumpEff}</div><div class="summary-unit">%</div></div>
        <div class="summary-item"><div class="summary-label">NPSH Available</div><div class="summary-value">${res.npsh.npsha_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">NPSH Required</div><div class="summary-value">${res.npsh.npshr_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">Kecepatan Spesifik (Ns)</div><div class="summary-value">${Math.round(res.npsh.Ns)}</div><div class="summary-unit">rpm</div></div>
        <div class="summary-item"><div class="summary-label">Reynold's Number</div><div class="summary-value">${Math.round(res.suction.reynolds).toLocaleString()}</div><div class="summary-unit"></div></div>
    `;
    
    // --- Hydraulic Table ---
    const hydraulicBody = document.querySelector('#hydraulicTable tbody');
    hydraulicBody.innerHTML = `
        <tr><td class="fw-bold">Tekanan Operasi</td><td>${res.suction.opPress_atm} atm (${(res.suction.opPress_atm * 101325 / 1000).toFixed(0)} kPa)</td><td>${res.discharge.opPress_atm} atm (${(res.discharge.opPress_atm * 101325 / 1000).toFixed(0)} kPa)</td></tr>
        <tr><td class="fw-bold">Static Head</td><td>${res.suction.staticHead_m.toFixed(2)} m</td><td>${res.discharge.staticHead_m.toFixed(2)} m</td></tr>
        <tr><td class="fw-bold">Equipment Loss</td><td>${res.suction.eqLoss_psi} psi</td><td>${res.discharge.eqLoss_psi} psi</td></tr>
        <tr><td class="fw-bold">Panjang Pipa</td><td>${res.suction.length_m} m</td><td>${res.discharge.length_m} m</td></tr>
        <tr><td class="fw-bold">Pipe Size (NPS)</td><td>${res.suction.pipeSize}"</td><td>${res.discharge.pipeSize}"</td></tr>
        <tr><td class="fw-bold">ID Pipa</td><td>${res.suction.pipeID_in.toFixed(3)} in (${res.suction.pipeID_m.toFixed(3)} m)</td><td>${res.discharge.pipeID_in.toFixed(3)} in (${res.discharge.pipeID_m.toFixed(3)} m)</td></tr>
        <tr><td class="fw-bold">Velocity</td><td>${res.suction.velocity_mps.toFixed(2)} m/s</td><td>${res.discharge.velocity_mps.toFixed(2)} m/s</td></tr>
        <tr><td class="fw-bold">Reynold's Number</td><td colspan="2">${Math.round(res.suction.reynolds).toLocaleString()}</td></tr>
        <tr><td class="fw-bold">Friction Factor (f)</td><td colspan="2">${res.frictionFactor.toFixed(4)}</td></tr>
        <tr><td class="fw-bold">Pipe Friction Loss</td><td>${res.suction.pipeLoss_m.toFixed(2)} m</td><td>${res.discharge.pipeLoss_m.toFixed(2)} m</td></tr>
        <tr><td class="fw-bold">Fitting Loss</td><td>${res.suction.fittingLoss_m.toFixed(2)} m</td><td>${res.discharge.fittingLoss_m.toFixed(2)} m</td></tr>
        <tr><td class="fw-bold">Tekanan Akhir di Pompa</td><td>${(res.suction.opPress_atm - (res.suction.eqLoss_psi/14.7) - (res.suction.pipeLoss_m * density * 9.81 / 101325)).toFixed(2)} atm</td><td>${(res.discharge.opPress_atm + (res.discharge.eqLoss_psi/14.7) + (res.discharge.pipeLoss_m * density * 9.81 / 101325)).toFixed(2)} atm</td></tr>
    `;
    
    // --- Fitting Table ---
    const fittingBody = document.querySelector('#fittingTable tbody');
    const allFittingNames = [...new Set([...res.suction.fittings.map(f => f.name), ...res.discharge.fittings.map(f => f.name)])];
    fittingBody.innerHTML = allFittingNames.map(name => {
        const s = res.suction.fittings.find(f => f.name === name);
        const d = res.discharge.fittings.find(f => f.name === name);
        const sLe = s ? (s.le_per_d ? (s.qty * s.le_per_d * res.suction.pipeID_m).toFixed(2) : (s.qty * (s.k / 0.02) * res.suction.pipeID_m).toFixed(2)) : '0';
        const dLe = d ? (d.le_per_d ? (d.qty * d.le_per_d * res.discharge.pipeID_m).toFixed(2) : (d.qty * (d.k / 0.02) * res.discharge.pipeID_m).toFixed(2)) : '0';
        return `<tr><td>${name}</td><td>${s ? s.qty : 0}</td><td>${sLe} m</td><td>${d ? d.qty : 0}</td><td>${dLe} m</td></tr>`;
    }).join('');
    
    // --- Final Results ---
    document.getElementById('finalResults').innerHTML = `
        <div class="final-item"><div class="final-label">Differential Head</div><div class="final-value">${res.headComponents.totalHead_m.toFixed(1)}</div><div class="final-unit">m</div></div>
        <div class="final-item"><div class="final-label">Differential Head</div><div class="final-value">${res.headComponents.totalHead_ft.toFixed(1)}</div><div class="final-unit">ft</div></div>
        <div class="final-item"><div class="final-label">Hydraulic Power</div><div class="final-value">${res.power.Ph_HP.toFixed(2)}</div><div class="final-unit">HP</div></div>
        <div class="final-item"><div class="final-label">Pump BHP</div><div class="final-value">${res.power.pumpBHP.toFixed(2)}</div><div class="final-unit">HP</div></div>
        <div class="final-item"><div class="final-label">NPSH Available</div><div class="final-value">${res.npsh.npsha_m.toFixed(2)}</div><div class="final-unit">m</div></div>
    `;
    
    // --- Motor Specification ---
    document.getElementById('motorSpec').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
            <div><i class="fas fa-motorcycle me-2"></i><strong>Spesifikasi Motor</strong></div>
            <div><span class="badge-motor">${res.motor.motorType}</span></div>
        </div>
        <hr class="my-2">
        <div class="row g-2 mt-1">
            <div class="col-6 col-md-3"><small class="text-muted">Daya Dibutuhkan</small><br><strong>${res.power.pumpBHP.toFixed(2)} HP</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Motor Standar Dipilih</small><br><strong>${res.power.motorStandard_HP} HP</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kecepatan Sinkron</small><br><strong>${res.motor.syncSpeed_rpm} rpm</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kecepatan Aktual</small><br><strong>${Math.round(res.motor.actualSpeed_rpm)} rpm</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Jumlah Kutub</small><br><strong>${res.motor.motorPoles} Pole</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Frekuensi</small><br><strong>50 Hz</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Slip Motor</small><br><strong>${res.motor.slip}%</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kecepatan Spesifik (Ns)</small><br><strong>${Math.round(res.npsh.Ns)} rpm</strong></div>
            <div class="col-12 mt-2"><small class="text-muted">Cavitation Status</small><br><strong class="text-${res.npsh.cavitationStatus.includes('Aman') ? 'success' : 'danger'}">${res.npsh.cavitationStatus}</strong></div>
        </div>
        <div class="mt-2 pt-2 border-top">
            <small class="text-muted">Jenis Pompa: Centrifugal Single Stage</small><br>
            <small class="text-muted">Bahan: Carbon Steel / Stainless Steel (sesuai kebutuhan)</small>
        </div>
    `;
    
    document.getElementById('resultsContainer').scrollIntoView({ behavior: 'smooth' });
}

function exportToExcel() {
    if (!currentResults) return;
    const res = currentResults;
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Summary
    const ws1 = XLSX.utils.aoa_to_sheet([
        ['Kode Alat', res.project.kodeAlat], ['PIC', res.project.pic], ['Date', res.project.date], ['Revision', res.project.revision], [''],
        ['PUMP SIZING SUMMARY'], ['Parameter', 'Value', 'Unit'],
        ['Flowrate', res.fluid.flowrate_m3h.toFixed(2), 'm³/jam'],
        ['Density', res.fluid.density, 'kg/m³'],
        ['Viscosity', res.fluid.viscosity_cp, 'cP'],
        ['Vapor Pressure', res.fluid.vaporPressure_psi, 'psi'],
        ['Pump Efficiency', res.fluid.pumpEff, '%'],
        [''], ['Total Head', res.headComponents.totalHead_m.toFixed(2), 'm'],
        ['Total Head', res.headComponents.totalHead_ft.toFixed(1), 'ft'],
        ['Hydraulic Power', res.power.Ph_HP.toFixed(2), 'HP'],
        ['Pump BHP Required', res.power.pumpBHP.toFixed(2), 'HP'],
        ['Motor Standar', res.power.motorStandard_HP, 'HP'],
        ['NPSH Available', res.npsh.npsha_m.toFixed(2), 'm'],
        ['NPSH Required', res.npsh.npshr_m.toFixed(2), 'm'],
        ['Kecepatan Spesifik (Ns)', Math.round(res.npsh.Ns), 'rpm'],
        ["Reynold's Number", Math.round(res.suction.reynolds).toLocaleString(), ''],
        ['Kecepatan Aktual Motor', Math.round(res.motor.actualSpeed_rpm), 'rpm']
    ]);
    ws1['!cols'] = [{wch:25}, {wch:18}, {wch:10}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    
    // Sheet 2: Hydraulic Data
    const ws2 = XLSX.utils.aoa_to_sheet([
        ['Hydraulic Data', '', ''], ['Parameter', 'Suction', 'Discharge'],
        ['Tekanan Operasi (atm)', res.suction.opPress_atm, res.discharge.opPress_atm],
        ['Static Head (m)', res.suction.staticHead_m, res.discharge.staticHead_m],
        ['Equipment Loss (psi)', res.suction.eqLoss_psi, res.discharge.eqLoss_psi],
        ['Panjang Pipa (m)', res.suction.length_m, res.discharge.length_m],
        ['NPS', `${res.suction.pipeSize}"`, `${res.discharge.pipeSize}"`],
        ['ID Pipa (in)', res.suction.pipeID_in.toFixed(3), res.discharge.pipeID_in.toFixed(3)],
        ['Velocity (m/s)', res.suction.velocity_mps.toFixed(2), res.discharge.velocity_mps.toFixed(2)],
        ["Reynold's Number", Math.round(res.suction.reynolds), Math.round(res.suction.reynolds)],
        ['Friction Factor', res.frictionFactor.toFixed(4), res.frictionFactor.toFixed(4)],
        ['Pipe Friction Loss (m)', res.suction.pipeLoss_m.toFixed(2), res.discharge.pipeLoss_m.toFixed(2)],
        ['Fitting Loss (m)', res.suction.fittingLoss_m.toFixed(2), res.discharge.fittingLoss_m.toFixed(2)]
    ]);
    ws2['!cols'] = [{wch:30}, {wch:15}, {wch:15}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Hydraulic Data');
    
    // Sheet 3: Head Components
    const ws3 = XLSX.utils.aoa_to_sheet([
        ['HEAD COMPONENTS', 'Value (m)'],
        ['Pressure Head', res.headComponents.pressureHead_m.toFixed(2)],
        ['Static Head', res.headComponents.staticHead_m.toFixed(2)],
        ['Velocity Head', res.headComponents.velocityHead_m.toFixed(4)],
        ['Friction Head', res.headComponents.frictionHead_m.toFixed(2)],
        ['TOTAL HEAD', res.headComponents.totalHead_m.toFixed(2)]
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, 'Head Components');
    
    // Sheet 4: Motor Spec
    const ws4 = XLSX.utils.aoa_to_sheet([
        ['MOTOR SPECIFICATION', ''],
        ['Motor Type', res.motor.motorType],
        ['Jumlah Kutub', res.motor.motorPoles],
        ['Frekuensi', '50 Hz'],
        ['Slip', `${res.motor.slip}%`],
        ['Kecepatan Sinkron', `${res.motor.syncSpeed_rpm} rpm`],
        ['Kecepatan Aktual', `${Math.round(res.motor.actualSpeed_rpm)} rpm`],
        ['Daya Dibutuhkan', `${res.power.pumpBHP.toFixed(2)} HP`],
        ['Motor Standar Dipilih', `${res.power.motorStandard_HP} HP`],
        ['Kecepatan Spesifik (Ns)', `${Math.round(res.npsh.Ns)} rpm`],
        ['Cavitation Status', res.npsh.cavitationStatus]
    ]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Motor Specification');
    
    const fileName = `Pump_Sizing_${res.project.kodeAlat}_${res.project.date.replace(/[/, :]/g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Event Listeners
document.getElementById('calculateBtn').addEventListener('click', calculatePump);
document.getElementById('exportBtn').addEventListener('click', exportToExcel);