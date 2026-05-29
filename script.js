// ============================================================
// Pump Sizing Calculator — Enhanced with ΔP & Custom Fittings
// ============================================================

let currentResults = null;

// Standard motor HP (NEMA)
const standardMotorHP = [0.125,0.25,0.33,0.5,0.75,1,1.5,2,3,5,7.5,10,15,20,25,30,40,50,60,75,100,125,150,200,250,300,350,400,450,500];

// Fitting catalogue: { name, type:'led'|'k', value, icon }
const FITTING_CATALOGUE = [
    { name: 'Elbow 90° Standard',   type:'led', value: 30,  icon:'↺' },
    { name: 'Elbow 90° Long Radius',type:'led', value: 16,  icon:'↺' },
    { name: 'Elbow 45°',            type:'led', value: 16,  icon:'↗' },
    { name: 'Tee (Thru)',           type:'led', value: 20,  icon:'T' },
    { name: 'Tee (Branch)',         type:'led', value: 60,  icon:'T' },
    { name: 'Gate Valve (Full)',     type:'led', value: 13,  icon:'⊞' },
    { name: 'Gate Valve (3/4)',      type:'led', value: 35,  icon:'⊞' },
    { name: 'Gate Valve (1/2)',      type:'led', value: 160, icon:'⊞' },
    { name: 'Gate Valve (1/4)',      type:'led', value: 900, icon:'⊞' },
    { name: 'Globe Valve',           type:'led', value: 340, icon:'◉' },
    { name: 'Angle Valve',           type:'led', value: 170, icon:'◑' },
    { name: 'Butterfly Valve',       type:'led', value: 40,  icon:'◈' },
    { name: 'Ball Valve',            type:'led', value: 3,   icon:'●' },
    { name: 'Check Valve (Swing)',   type:'led', value: 135, icon:'⮐' },
    { name: 'Check Valve (Lift)',    type:'led', value: 600, icon:'⮑' },
    { name: 'Foot Valve w/ Strainer',type:'led', value: 420, icon:'⊗' },
    { name: 'Reducer (Gradual)',     type:'led', value: 7,   icon:'▷' },
    { name: 'Reducer (Sudden)',      type:'led', value: 25,  icon:'▶' },
    { name: 'Pipe Entrance (Sharp)', type:'k',   value: 0.5, icon:'⇥' },
    { name: 'Pipe Entrance (Bell)',  type:'k',   value: 0.1, icon:'⇥' },
    { name: 'Pipe Exit',             type:'k',   value: 1.0, icon:'⇤' },
    { name: 'Sudden Contraction',    type:'k',   value: 0.5, icon:'◁' },
    { name: 'Sudden Expansion',      type:'k',   value: 1.0, icon:'▷' },
];

// ── State: fittings lists per side ──────────────────────────
const fittingState = {
    suction:   [],   // [{name, type, value, qty, id}]
    discharge: []
};

let fittingCounter = 0;

function getStandardMotor(hp) {
    for (let s of standardMotorHP) if (s >= hp) return s;
    return hp;
}

// ── Bootstrap fittings UI ────────────────────────────────────
function initFittings() {
    ['suction','discharge'].forEach(side => {
        const sel = document.getElementById(`${side}-fitting-select`);
        sel.innerHTML = FITTING_CATALOGUE.map((f,i) =>
            `<option value="${i}">${f.icon} ${f.name} (${f.type==='led'?'Le/D='+f.value:'K='+f.value})</option>`
        ).join('');

        document.getElementById(`${side}-add-btn`).addEventListener('click', () => {
            const idx = parseInt(sel.value);
            addFitting(side, FITTING_CATALOGUE[idx]);
        });

        // Default fittings
        if (side === 'suction') {
            addFitting('suction', FITTING_CATALOGUE.find(f=>f.name==='Elbow 90° Standard'), 1);
            addFitting('suction', FITTING_CATALOGUE.find(f=>f.name==='Gate Valve (Full)'), 1);
            addFitting('suction', FITTING_CATALOGUE.find(f=>f.name==='Pipe Entrance (Sharp)'), 1);
        } else {
            addFitting('discharge', FITTING_CATALOGUE.find(f=>f.name==='Elbow 90° Standard'), 3);
            addFitting('discharge', FITTING_CATALOGUE.find(f=>f.name==='Gate Valve (Full)'), 1);
            addFitting('discharge', FITTING_CATALOGUE.find(f=>f.name==='Check Valve (Swing)'), 1);
            addFitting('discharge', FITTING_CATALOGUE.find(f=>f.name==='Pipe Exit'), 1);
        }
    });

    // Tab switching
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const side = tab.dataset.tab;
            document.getElementById('panel-suction').style.display   = side==='suction'   ? '' : 'none';
            document.getElementById('panel-discharge').style.display = side==='discharge' ? '' : 'none';
        });
    });
}

function addFitting(side, catalogue, qty=1) {
    if (!catalogue) return;
    const id = ++fittingCounter;
    fittingState[side].push({ ...catalogue, qty, id });
    renderFittingList(side);
}

function renderFittingList(side) {
    const list = document.getElementById(`${side}-fittings-list`);
    list.innerHTML = '';

    fittingState[side].forEach(item => {
        const row = document.createElement('div');
        row.className = 'fitting-row d-flex align-items-center gap-1 mb-1';
        row.dataset.id = item.id;

        const label = item.type==='led'
            ? `<span class="fitting-type-badge led">Le/D=${item.value}</span>`
            : `<span class="fitting-type-badge k-val">K=${item.value}</span>`;

        row.innerHTML = `
            <span class="fitting-row-icon">${item.icon}</span>
            <span class="fitting-row-name flex-grow-1">${item.name}</span>
            ${label}
            <input type="number" min="0" step="1" value="${item.qty}"
                class="fitting-qty-input form-control form-control-sm"
                style="width:58px;text-align:center"
                data-id="${item.id}" data-side="${side}">
            <button class="btn btn-sm fitting-del-btn" data-id="${item.id}" data-side="${side}" title="Hapus">
                <i class="fas fa-times"></i>
            </button>
        `;
        list.appendChild(row);
    });

    // Event listeners
    list.querySelectorAll('.fitting-qty-input').forEach(inp => {
        inp.addEventListener('input', () => {
            const id = parseInt(inp.dataset.id);
            const s = inp.dataset.side;
            const item = fittingState[s].find(f=>f.id===id);
            if (item) item.qty = parseFloat(inp.value)||0;
            updateFittingTotal(s);
        });
    });
    list.querySelectorAll('.fitting-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const s = btn.dataset.side;
            fittingState[s] = fittingState[s].filter(f=>f.id!==id);
            renderFittingList(s);
        });
    });

    updateFittingTotal(side);
}

function updateFittingTotal(side) {
    const pipeEl = document.getElementById(side==='suction'?'suctionPipe':'dischargePipe');
    const pipeVals = pipeEl.value.split(',');
    const D_m = parseFloat(pipeVals[1]) * 0.0254;
    let totalLe = 0;
    fittingState[side].forEach(item => {
        if (item.type==='led') totalLe += item.qty * item.value * D_m;
        else totalLe += item.qty * (item.value/0.02) * D_m;
    });
    document.getElementById(`${side}-total-le`).textContent = isNaN(totalLe) ? '— m' : totalLe.toFixed(2)+' m';
}

// ── Core calculation ─────────────────────────────────────────
function calculateFittingLossFromState(side, D_m) {
    let totalLe = 0;
    fittingState[side].forEach(item => {
        if (item.type==='led') totalLe += item.qty * item.value * D_m;
        else totalLe += item.qty * (item.value/0.02) * D_m;
    });
    return totalLe; // in meters
}

function calculatePump() {
    const flowrate_m3h  = parseFloat(document.getElementById('flowrate').value);
    const density       = parseFloat(document.getElementById('density').value);
    const viscosity_cp  = parseFloat(document.getElementById('viscosity').value);
    const vaporPressure_psi = parseFloat(document.getElementById('vaporPressure').value);
    const pumpEff       = parseFloat(document.getElementById('pumpEfficiency').value)/100;
    const roughness_mm  = parseFloat(document.getElementById('pipeRoughness').value)||0.046;

    const suctionOpPress_atm   = parseFloat(document.getElementById('suctionOpPress').value);
    const suctionStaticHead_m  = parseFloat(document.getElementById('suctionStaticHead').value);
    const suctionEqLoss_psi    = parseFloat(document.getElementById('suctionEqLoss').value);
    const suctionLength_m      = parseFloat(document.getElementById('suctionLength').value);
    const suctionPipeArr       = document.getElementById('suctionPipe').value.split(',');
    const suctionNPS           = suctionPipeArr[0];
    const suctionID_in         = parseFloat(suctionPipeArr[1]);

    const dischargeOpPress_atm  = parseFloat(document.getElementById('dischargeOpPress').value);
    const dischargeStaticHead_m = parseFloat(document.getElementById('dischargeStaticHead').value);
    const dischargeEqLoss_psi   = parseFloat(document.getElementById('dischargeEqLoss').value);
    const dischargeLength_m     = parseFloat(document.getElementById('dischargeLength').value);
    const dischargePipeArr      = document.getElementById('dischargePipe').value.split(',');
    const dischargeNPS          = dischargePipeArr[0];
    const dischargeID_in        = parseFloat(dischargePipeArr[1]);

    const motorType  = document.getElementById('motorType').value;
    const motorPoles = parseInt(document.getElementById('motorPoles').value);
    const slip       = parseFloat(document.getElementById('slip').value)/100;

    // ── Unit conversion ──
    const flowrate_m3s  = flowrate_m3h/3600;
    const suctionID_m   = suctionID_in * 0.0254;
    const dischargeID_m = dischargeID_in * 0.0254;

    // ── Velocity ──
    const A_s = Math.PI*Math.pow(suctionID_m,2)/4;
    const A_d = Math.PI*Math.pow(dischargeID_m,2)/4;
    const v_s = flowrate_m3s/A_s;
    const v_d = flowrate_m3s/A_d;

    // ── Reynolds (suction-based) ──
    const mu = viscosity_cp*0.001;
    const Re = (density*v_s*suctionID_m)/mu;
    const Re_d = (density*v_d*dischargeID_m)/mu;

    // ── Friction factor (Colebrook-White / Swamee-Jain) ──
    function frictionFactor(Re, D_m) {
        if (Re < 2100) return 64/Re;
        const eps = roughness_mm/1000;
        const rough = eps/D_m;
        // Swamee-Jain explicit
        const f = 0.25/Math.pow(Math.log10(rough/3.7 + 5.74/Math.pow(Re,0.9)),2);
        return Math.max(0.008, Math.min(0.08, f));
    }
    const f_s = frictionFactor(Re, suctionID_m);
    const f_d = frictionFactor(Re_d, dischargeID_m);

    // ── Darcy-Weisbach: ΔP per meter (Pa/m) ──
    const dP_per_m_s = f_s*(1/suctionID_m)*(density*Math.pow(v_s,2)/2);
    const dP_per_m_d = f_d*(1/dischargeID_m)*(density*Math.pow(v_d,2)/2);

    // ── Friction loss: straight pipe ──
    const suctionPipeDP_Pa    = dP_per_m_s * suctionLength_m;
    const dischargePipeDP_Pa  = dP_per_m_d * dischargeLength_m;
    const suctionPipeLoss_m   = suctionPipeDP_Pa/(density*9.81);
    const dischargePipeLoss_m = dischargePipeDP_Pa/(density*9.81);

    // ── Fitting Le & ΔP ──
    const suctionFitLe_m   = calculateFittingLossFromState('suction',   suctionID_m);
    const dischargeFitLe_m = calculateFittingLossFromState('discharge', dischargeID_m);

    const suctionFitDP_Pa    = dP_per_m_s * suctionFitLe_m;
    const dischargeFitDP_Pa  = dP_per_m_d * dischargeFitLe_m;
    const suctionFitLoss_m   = suctionFitDP_Pa/(density*9.81);
    const dischargeFitLoss_m = dischargeFitDP_Pa/(density*9.81);

    // ── Equipment loss ──
    const suctionEqDP_Pa    = suctionEqLoss_psi * 6894.76;
    const dischargeEqDP_Pa  = dischargeEqLoss_psi * 6894.76;
    const suctionEqLoss_m   = suctionEqDP_Pa/(density*9.81);
    const dischargeEqLoss_m = dischargeEqDP_Pa/(density*9.81);

    // ── Total ΔP per side ──
    const suctionTotalDP_Pa    = suctionPipeDP_Pa   + suctionFitDP_Pa   + suctionEqDP_Pa;
    const dischargeTotalDP_Pa  = dischargePipeDP_Pa + dischargeFitDP_Pa + dischargeEqDP_Pa;
    const systemTotalDP_Pa     = suctionTotalDP_Pa  + dischargeTotalDP_Pa;

    // ── Pressure head ──
    const P1_Pa = suctionOpPress_atm * 101325;
    const P2_Pa = dischargeOpPress_atm * 101325;
    const pressureHead_m = (P2_Pa - P1_Pa)/(density*9.81);

    // ── Static head ──
    const staticHead_m = dischargeStaticHead_m - suctionStaticHead_m;

    // ── Velocity head ──
    const velocityHead_m = (Math.pow(v_d,2) - Math.pow(v_s,2))/(2*9.81);

    // ── Friction head total ──
    const frictionHead_m = suctionPipeLoss_m + dischargePipeLoss_m + suctionFitLoss_m + dischargeFitLoss_m + suctionEqLoss_m + dischargeEqLoss_m;

    // ── Total pump head ──
    const totalHead_m  = pressureHead_m + staticHead_m + velocityHead_m + frictionHead_m;
    const totalHead_ft = totalHead_m * 3.28084;

    // ── Power ──
    const Ph_kW   = flowrate_m3s * totalHead_m * density * 9.81 / 1000;
    const Ph_HP   = Ph_kW / 0.7457;
    const pumpBHP = Ph_HP / pumpEff;
    const motorStandard_HP = getStandardMotor(pumpBHP);

    // ── Motor ──
    const syncSpeed_rpm   = 120*50/motorPoles;
    const actualSpeed_rpm = syncSpeed_rpm*(1-slip);

    // ── Specific speed ──
    const Q_gpm  = flowrate_m3h * 4.40287;
    const Ns_rpm = actualSpeed_rpm * Math.sqrt(Q_gpm) / Math.pow(totalHead_ft, 0.75);

    // ── NPSHa ──
    const Pv_Pa    = vaporPressure_psi * 6894.76;
    const npsha_m  = ((P1_Pa - Pv_Pa)/(density*9.81)) + suctionStaticHead_m - (suctionPipeLoss_m + suctionFitLoss_m + suctionEqLoss_m);

    // ── NPSHr estimate ──
    let npshr_m = Ns_rpm<1000?2:Ns_rpm<2000?3+(Ns_rpm-1000)*0.008:Ns_rpm<3000?11+(Ns_rpm-2000)*0.02:31;
    const cavitationStatus = npsha_m > npshr_m ? 'Aman (NPSHa > NPSHr)' : 'Warning: NPSHa < NPSHr';

    // helper: Pa→kPa, Pa→psi, Pa→bar
    const Pa2kPa = p => p/1000;
    const Pa2psi = p => p/6894.76;
    const Pa2bar = p => p/100000;

    currentResults = {
        project: {
            kodeAlat: document.getElementById('kodeAlat').value,
            pic: document.getElementById('pic').value,
            date: document.getElementById('calcDate').value,
            revision: document.getElementById('revision').value
        },
        fluid: { flowrate_m3h, flowrate_m3s, density, viscosity_cp, vaporPressure_psi, pumpEff: pumpEff*100 },
        suction: {
            opPress_atm: suctionOpPress_atm, staticHead_m: suctionStaticHead_m,
            eqLoss_psi: suctionEqLoss_psi, length_m: suctionLength_m,
            pipeSize: suctionNPS, pipeID_in: suctionID_in, pipeID_m: suctionID_m,
            velocity_mps: v_s, reynolds: Re, frictionFactor: f_s,
            dP_per_m: dP_per_m_s,
            pipeLoss_m: suctionPipeLoss_m, pipeDP_Pa: suctionPipeDP_Pa,
            fitLoss_m: suctionFitLoss_m,   fitDP_Pa:  suctionFitDP_Pa,
            eqLoss_m:  suctionEqLoss_m,    eqDP_Pa:   suctionEqDP_Pa,
            totalDP_Pa: suctionTotalDP_Pa,
            fittings: [...fittingState.suction]
        },
        discharge: {
            opPress_atm: dischargeOpPress_atm, staticHead_m: dischargeStaticHead_m,
            eqLoss_psi: dischargeEqLoss_psi, length_m: dischargeLength_m,
            pipeSize: dischargeNPS, pipeID_in: dischargeID_in, pipeID_m: dischargeID_m,
            velocity_mps: v_d, reynolds: Re_d, frictionFactor: f_d,
            dP_per_m: dP_per_m_d,
            pipeLoss_m: dischargePipeLoss_m, pipeDP_Pa: dischargePipeDP_Pa,
            fitLoss_m:  dischargeFitLoss_m,  fitDP_Pa:  dischargeFitDP_Pa,
            eqLoss_m:   dischargeEqLoss_m,   eqDP_Pa:   dischargeEqDP_Pa,
            totalDP_Pa: dischargeTotalDP_Pa,
            fittings: [...fittingState.discharge]
        },
        dp: {
            suctionTotal_Pa: suctionTotalDP_Pa,
            dischargeTotal_Pa: dischargeTotalDP_Pa,
            systemTotal_Pa: systemTotalDP_Pa,
            Pa2kPa, Pa2psi, Pa2bar
        },
        headComponents: { pressureHead_m, staticHead_m, velocityHead_m, frictionHead_m, totalHead_m, totalHead_ft },
        power: { Ph_kW, Ph_HP, pumpBHP, motorRequired_HP: pumpBHP, motorStandard_HP },
        motor: { motorType, motorPoles, syncSpeed_rpm, actualSpeed_rpm, slip: slip*100 },
        npsh: { npsha_m, npshr_m, cavitationStatus, Ns: Ns_rpm },
        frictionFactor: f_s
    };

    displayResults();
    document.getElementById('exportBtn').disabled = false;
}

// ── Display ──────────────────────────────────────────────────
function displayResults() {
    const res = currentResults;
    document.getElementById('resultsContainer').style.display = 'block';
    document.getElementById('noResults').style.display = 'none';

    const dp = res.dp;
    const rho = res.fluid.density;

    // ── Summary Grid ──
    document.getElementById('summaryGrid').innerHTML = `
        <div class="summary-item"><div class="summary-label">Kode Alat</div><div class="summary-value" style="font-size:1rem">${res.project.kodeAlat}</div></div>
        <div class="summary-item"><div class="summary-label">Flowrate</div><div class="summary-value">${res.fluid.flowrate_m3h.toFixed(2)}</div><div class="summary-unit">m³/jam</div></div>
        <div class="summary-item"><div class="summary-label">Total Head</div><div class="summary-value">${res.headComponents.totalHead_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">Total Head</div><div class="summary-value">${res.headComponents.totalHead_ft.toFixed(1)}</div><div class="summary-unit">ft</div></div>
        <div class="summary-item"><div class="summary-label">Hydraulic Power</div><div class="summary-value">${res.power.Ph_HP.toFixed(2)}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Pump BHP</div><div class="summary-value">${res.power.pumpBHP.toFixed(2)}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Motor Standar</div><div class="summary-value">${res.power.motorStandard_HP}</div><div class="summary-unit">HP</div></div>
        <div class="summary-item"><div class="summary-label">Efisiensi Pompa</div><div class="summary-value">${res.fluid.pumpEff}</div><div class="summary-unit">%</div></div>
        <div class="summary-item"><div class="summary-label">NPSH Available</div><div class="summary-value">${res.npsh.npsha_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">NPSH Required</div><div class="summary-value">${res.npsh.npshr_m.toFixed(2)}</div><div class="summary-unit">m</div></div>
        <div class="summary-item"><div class="summary-label">Reynold's Number</div><div class="summary-value" style="font-size:0.95rem">${Math.round(res.suction.reynolds).toLocaleString()}</div></div>
        <div class="summary-item"><div class="summary-label">Flow Regime</div><div class="summary-value" style="font-size:0.85rem">${res.suction.reynolds<2100?'Laminar':res.suction.reynolds<4000?'Transitional':'Turbulent'}</div></div>
    `;

    // ── ΔP Summary Grid ──
    document.getElementById('dpGrid').innerHTML = `
        <div class="summary-item" style="border-left-color:#e74c3c">
            <div class="summary-label">ΔP Total System</div>
            <div class="summary-value" style="color:#e74c3c">${dp.Pa2kPa(dp.systemTotal_Pa).toFixed(2)}</div>
            <div class="summary-unit">kPa</div>
        </div>
        <div class="summary-item" style="border-left-color:#e74c3c">
            <div class="summary-label">ΔP Total System</div>
            <div class="summary-value" style="color:#e74c3c">${dp.Pa2psi(dp.systemTotal_Pa).toFixed(3)}</div>
            <div class="summary-unit">psi</div>
        </div>
        <div class="summary-item" style="border-left-color:#e74c3c">
            <div class="summary-label">ΔP Total System</div>
            <div class="summary-value" style="color:#e74c3c">${dp.Pa2bar(dp.systemTotal_Pa).toFixed(4)}</div>
            <div class="summary-unit">bar</div>
        </div>
        <div class="summary-item" style="border-left-color:#e67e22">
            <div class="summary-label">ΔP Suction Side</div>
            <div class="summary-value" style="color:#e67e22">${dp.Pa2kPa(dp.suctionTotal_Pa).toFixed(2)}</div>
            <div class="summary-unit">kPa</div>
        </div>
        <div class="summary-item" style="border-left-color:#8e44ad">
            <div class="summary-label">ΔP Discharge Side</div>
            <div class="summary-value" style="color:#8e44ad">${dp.Pa2kPa(dp.dischargeTotal_Pa).toFixed(2)}</div>
            <div class="summary-unit">kPa</div>
        </div>
        <div class="summary-item" style="border-left-color:#27ae60">
            <div class="summary-label">ΔP/m Suction</div>
            <div class="summary-value" style="color:#27ae60">${res.suction.dP_per_m.toFixed(1)}</div>
            <div class="summary-unit">Pa/m</div>
        </div>
    `;

    // ── ΔP Table ──
    const rows = [
        ['Pipe Friction (straight)',
            res.suction.pipeDP_Pa, res.discharge.pipeDP_Pa],
        ['Fittings (equiv. length)',
            res.suction.fitDP_Pa, res.discharge.fitDP_Pa],
        ['Equipment Loss',
            res.suction.eqDP_Pa, res.discharge.eqDP_Pa],
    ];
    document.querySelector('#dpTable tbody').innerHTML = rows.map(([label, s, d]) => {
        const total = s + d;
        return `<tr>
            <td class="fw-bold">${label}</td>
            <td>${dp.Pa2kPa(s).toFixed(3)} kPa <span class="text-muted small">(${dp.Pa2psi(s).toFixed(3)} psi)</span></td>
            <td>${dp.Pa2kPa(d).toFixed(3)} kPa <span class="text-muted small">(${dp.Pa2psi(d).toFixed(3)} psi)</span></td>
            <td><strong>${dp.Pa2kPa(total).toFixed(3)} kPa</strong> <span class="text-muted small">(${dp.Pa2bar(total).toFixed(5)} bar)</span></td>
        </tr>`;
    }).join('') + `<tr class="table-active fw-bold">
        <td>TOTAL</td>
        <td>${dp.Pa2kPa(dp.suctionTotal_Pa).toFixed(3)} kPa</td>
        <td>${dp.Pa2kPa(dp.dischargeTotal_Pa).toFixed(3)} kPa</td>
        <td>${dp.Pa2kPa(dp.systemTotal_Pa).toFixed(3)} kPa</td>
    </tr>`;

    // ── Hydraulic Table ──
    const hb = document.querySelector('#hydraulicTable tbody');
    const s = res.suction; const d = res.discharge;
    hb.innerHTML = `
        <tr><td class="fw-bold">Tekanan Operasi</td>
            <td>${s.opPress_atm} atm (${(s.opPress_atm*101.325).toFixed(0)} kPa)</td>
            <td>${d.opPress_atm} atm (${(d.opPress_atm*101.325).toFixed(0)} kPa)</td></tr>
        <tr><td class="fw-bold">Static Head</td>
            <td>${s.staticHead_m.toFixed(2)} m</td><td>${d.staticHead_m.toFixed(2)} m</td></tr>
        <tr><td class="fw-bold">Equipment Loss</td>
            <td>${s.eqLoss_psi} psi (${dp.Pa2kPa(s.eqDP_Pa).toFixed(2)} kPa)</td>
            <td>${d.eqLoss_psi} psi (${dp.Pa2kPa(d.eqDP_Pa).toFixed(2)} kPa)</td></tr>
        <tr><td class="fw-bold">Panjang Pipa</td>
            <td>${s.length_m} m</td><td>${d.length_m} m</td></tr>
        <tr><td class="fw-bold">Pipe Size (NPS)</td>
            <td>${s.pipeSize}"</td><td>${d.pipeSize}"</td></tr>
        <tr><td class="fw-bold">ID Pipa</td>
            <td>${s.pipeID_in.toFixed(3)}" (${(s.pipeID_m*1000).toFixed(1)} mm)</td>
            <td>${d.pipeID_in.toFixed(3)}" (${(d.pipeID_m*1000).toFixed(1)} mm)</td></tr>
        <tr><td class="fw-bold">Velocity</td>
            <td>${s.velocity_mps.toFixed(3)} m/s</td><td>${d.velocity_mps.toFixed(3)} m/s</td></tr>
        <tr><td class="fw-bold">Reynold's Number</td>
            <td>${Math.round(s.reynolds).toLocaleString()}</td><td>${Math.round(d.reynolds).toLocaleString()}</td></tr>
        <tr><td class="fw-bold">Friction Factor (f)</td>
            <td>${s.frictionFactor.toFixed(5)}</td><td>${d.frictionFactor.toFixed(5)}</td></tr>
        <tr><td class="fw-bold">ΔP/m (Pipe)</td>
            <td>${s.dP_per_m.toFixed(2)} Pa/m</td><td>${d.dP_per_m.toFixed(2)} Pa/m</td></tr>
        <tr><td class="fw-bold">Pipe Friction Loss</td>
            <td>${s.pipeLoss_m.toFixed(3)} m (${dp.Pa2kPa(s.pipeDP_Pa).toFixed(3)} kPa)</td>
            <td>${d.pipeLoss_m.toFixed(3)} m (${dp.Pa2kPa(d.pipeDP_Pa).toFixed(3)} kPa)</td></tr>
        <tr><td class="fw-bold">Fitting Loss</td>
            <td>${s.fitLoss_m.toFixed(3)} m (${dp.Pa2kPa(s.fitDP_Pa).toFixed(3)} kPa)</td>
            <td>${d.fitLoss_m.toFixed(3)} m (${dp.Pa2kPa(d.fitDP_Pa).toFixed(3)} kPa)</td></tr>
    `;

    // ── Head Breakdown Visual ──
    const hc = res.headComponents;
    const total = Math.abs(hc.pressureHead_m) + Math.abs(hc.staticHead_m) + Math.abs(hc.velocityHead_m) + Math.abs(hc.frictionHead_m);
    const components = [
        { label:'Pressure Head', value:hc.pressureHead_m, color:'#3498db' },
        { label:'Static Head',   value:hc.staticHead_m,   color:'#2ecc71' },
        { label:'Velocity Head', value:hc.velocityHead_m, color:'#f39c12' },
        { label:'Friction Head', value:hc.frictionHead_m, color:'#e74c3c' },
    ];
    document.getElementById('headBreakdown').innerHTML = `
        <div style="margin-bottom:12px">
            ${components.map(c => {
                const pct = total>0 ? Math.abs(c.value)/total*100 : 0;
                return `<div style="margin-bottom:8px">
                    <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px">
                        <span style="font-weight:600;color:${c.color}">${c.label}</span>
                        <span>${c.value.toFixed(3)} m &nbsp;<span class="text-muted">(${pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style="background:#f0f2f5;border-radius:4px;height:12px;overflow:hidden">
                        <div style="width:${pct.toFixed(1)}%;background:${c.color};height:100%;border-radius:4px;transition:width 0.6s ease"></div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:10px;padding:12px 16px;color:white;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.85rem;opacity:0.8">Total Head (H)</span>
            <div>
                <span style="font-size:1.6rem;font-weight:700">${hc.totalHead_m.toFixed(2)}</span>
                <span style="opacity:0.7;font-size:0.8rem"> m &nbsp;/&nbsp; ${hc.totalHead_ft.toFixed(1)} ft</span>
            </div>
        </div>
    `;

    // ── Fitting Table ──
    const allNames = [...new Set([
        ...res.suction.fittings.map(f=>f.name),
        ...res.discharge.fittings.map(f=>f.name)
    ])];
    const fb = document.querySelector('#fittingTable tbody');
    if (allNames.length === 0) {
        fb.innerHTML = '<tr><td colspan="7" class="text-muted text-center">Tidak ada fitting ditambahkan</td></tr>';
    } else {
        fb.innerHTML = allNames.map(name => {
            const sf = res.suction.fittings.find(f=>f.name===name);
            const df = res.discharge.fittings.find(f=>f.name===name);
            const sLe = sf ? (sf.type==='led'?sf.qty*sf.value*res.suction.pipeID_m:sf.qty*(sf.value/0.02)*res.suction.pipeID_m) : 0;
            const dLe = df ? (df.type==='led'?df.qty*df.value*res.discharge.pipeID_m:df.qty*(df.value/0.02)*res.discharge.pipeID_m) : 0;
            const sDP = sLe * res.suction.dP_per_m;
            const dDP = dLe * res.discharge.dP_per_m;
            return `<tr>
                <td>${name}</td>
                <td class="text-center">${sf?sf.qty:0}</td>
                <td>${sLe.toFixed(3)} m</td>
                <td>${dp.Pa2kPa(sDP).toFixed(4)} kPa</td>
                <td class="text-center">${df?df.qty:0}</td>
                <td>${dLe.toFixed(3)} m</td>
                <td>${dp.Pa2kPa(dDP).toFixed(4)} kPa</td>
            </tr>`;
        }).join('');
    }

    // ── Final Results ──
    document.getElementById('finalResults').innerHTML = `
        <div class="final-item"><div class="final-label">Differential Head</div><div class="final-value">${hc.totalHead_m.toFixed(1)}</div><div class="final-unit">m</div></div>
        <div class="final-item"><div class="final-label">Differential Head</div><div class="final-value">${hc.totalHead_ft.toFixed(1)}</div><div class="final-unit">ft</div></div>
        <div class="final-item"><div class="final-label">System ΔP</div><div class="final-value">${dp.Pa2kPa(dp.systemTotal_Pa).toFixed(1)}</div><div class="final-unit">kPa</div></div>
        <div class="final-item"><div class="final-label">Hydraulic Power</div><div class="final-value">${res.power.Ph_HP.toFixed(2)}</div><div class="final-unit">HP</div></div>
        <div class="final-item"><div class="final-label">Pump BHP</div><div class="final-value">${res.power.pumpBHP.toFixed(2)}</div><div class="final-unit">HP</div></div>
        <div class="final-item"><div class="final-label">NPSH Available</div><div class="final-value">${res.npsh.npsha_m.toFixed(2)}</div><div class="final-unit">m</div></div>
    `;

    // ── Motor ──
    document.getElementById('motorSpec').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
            <div><i class="fas fa-bolt me-2"></i><strong>Spesifikasi Motor</strong></div>
            <span class="badge-motor">${res.motor.motorType}</span>
        </div>
        <hr class="my-2">
        <div class="row g-2 mt-1">
            <div class="col-6 col-md-3"><small class="text-muted">Daya Dibutuhkan</small><br><strong>${res.power.pumpBHP.toFixed(2)} HP</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Motor Standar</small><br><strong>${res.power.motorStandard_HP} HP</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kecepatan Sinkron</small><br><strong>${res.motor.syncSpeed_rpm} rpm</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kecepatan Aktual</small><br><strong>${Math.round(res.motor.actualSpeed_rpm)} rpm</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Jumlah Kutub</small><br><strong>${res.motor.motorPoles} Pole</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Frekuensi</small><br><strong>50 Hz</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Slip Motor</small><br><strong>${res.motor.slip}%</strong></div>
            <div class="col-6 col-md-3"><small class="text-muted">Kec. Spesifik (Ns)</small><br><strong>${Math.round(res.npsh.Ns)} rpm</strong></div>
            <div class="col-12 mt-2"><small class="text-muted">Cavitation Status</small><br>
                <strong class="text-${res.npsh.cavitationStatus.includes('Aman')?'success':'danger'}">${res.npsh.cavitationStatus}</strong>
            </div>
        </div>
    `;

    document.getElementById('resultsContainer').scrollIntoView({ behavior:'smooth' });
}

// ── Export to Excel ──────────────────────────────────────────
function exportToExcel() {
    if (!currentResults) return;
    const res = currentResults;
    const dp  = res.dp;
    const wb  = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet([
        ['PUMP SIZING CALCULATION'], [''],
        ['Kode Alat', res.project.kodeAlat], ['PIC', res.project.pic],
        ['Date', res.project.date], ['Revision', res.project.revision], [''],
        ['SUMMARY', '', ''], ['Parameter', 'Value', 'Unit'],
        ['Flowrate', res.fluid.flowrate_m3h.toFixed(2), 'm³/jam'],
        ['Density', res.fluid.density, 'kg/m³'],
        ['Viscosity', res.fluid.viscosity_cp, 'cP'],
        ['Total Head', res.headComponents.totalHead_m.toFixed(2), 'm'],
        ['Total Head', res.headComponents.totalHead_ft.toFixed(1), 'ft'],
        ['System ΔP Total', dp.Pa2kPa(dp.systemTotal_Pa).toFixed(3), 'kPa'],
        ['System ΔP Total', dp.Pa2psi(dp.systemTotal_Pa).toFixed(4), 'psi'],
        ['System ΔP Total', dp.Pa2bar(dp.systemTotal_Pa).toFixed(5), 'bar'],
        ['Hydraulic Power', res.power.Ph_HP.toFixed(2), 'HP'],
        ['Pump BHP Required', res.power.pumpBHP.toFixed(2), 'HP'],
        ['Motor Standar', res.power.motorStandard_HP, 'HP'],
        ['NPSH Available', res.npsh.npsha_m.toFixed(2), 'm'],
        ['NPSH Required', res.npsh.npshr_m.toFixed(2), 'm'],
        ['Kecepatan Aktual', Math.round(res.motor.actualSpeed_rpm), 'rpm'],
    ]);
    ws1['!cols'] = [{wch:28},{wch:18},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    const ws2 = XLSX.utils.aoa_to_sheet([
        ['PRESSURE DROP ANALYSIS', '', '', ''],
        ['Komponen', 'Suction (kPa)', 'Discharge (kPa)', 'Total (kPa)'],
        ['Pipe Friction', dp.Pa2kPa(res.suction.pipeDP_Pa).toFixed(3), dp.Pa2kPa(res.discharge.pipeDP_Pa).toFixed(3), dp.Pa2kPa(res.suction.pipeDP_Pa+res.discharge.pipeDP_Pa).toFixed(3)],
        ['Fittings', dp.Pa2kPa(res.suction.fitDP_Pa).toFixed(3), dp.Pa2kPa(res.discharge.fitDP_Pa).toFixed(3), dp.Pa2kPa(res.suction.fitDP_Pa+res.discharge.fitDP_Pa).toFixed(3)],
        ['Equipment Loss', dp.Pa2kPa(res.suction.eqDP_Pa).toFixed(3), dp.Pa2kPa(res.discharge.eqDP_Pa).toFixed(3), dp.Pa2kPa(res.suction.eqDP_Pa+res.discharge.eqDP_Pa).toFixed(3)],
        ['TOTAL', dp.Pa2kPa(dp.suctionTotal_Pa).toFixed(3), dp.Pa2kPa(dp.dischargeTotal_Pa).toFixed(3), dp.Pa2kPa(dp.systemTotal_Pa).toFixed(3)],
        [''], ['Unit Conversion:'],
        ['ΔP Total (Pa)', dp.systemTotal_Pa.toFixed(1)],
        ['ΔP Total (kPa)', dp.Pa2kPa(dp.systemTotal_Pa).toFixed(3)],
        ['ΔP Total (psi)', dp.Pa2psi(dp.systemTotal_Pa).toFixed(4)],
        ['ΔP Total (bar)', dp.Pa2bar(dp.systemTotal_Pa).toFixed(5)],
    ]);
    ws2['!cols'] = [{wch:20},{wch:18},{wch:18},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Pressure Drop');

    const fittingRows = [['Fitting', 'Qty (Suction)', 'Le Suction (m)', 'ΔP Suction (kPa)', 'Qty (Discharge)', 'Le Discharge (m)', 'ΔP Discharge (kPa)']];
    const allNames = [...new Set([...res.suction.fittings.map(f=>f.name),...res.discharge.fittings.map(f=>f.name)])];
    allNames.forEach(name => {
        const sf = res.suction.fittings.find(f=>f.name===name);
        const df = res.discharge.fittings.find(f=>f.name===name);
        const sLe = sf?(sf.type==='led'?sf.qty*sf.value*res.suction.pipeID_m:sf.qty*(sf.value/0.02)*res.suction.pipeID_m):0;
        const dLe = df?(df.type==='led'?df.qty*df.value*res.discharge.pipeID_m:df.qty*(df.value/0.02)*res.discharge.pipeID_m):0;
        fittingRows.push([name, sf?sf.qty:0, sLe.toFixed(4), dp.Pa2kPa(sLe*res.suction.dP_per_m).toFixed(4), df?df.qty:0, dLe.toFixed(4), dp.Pa2kPa(dLe*res.discharge.dP_per_m).toFixed(4)]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(fittingRows);
    ws3['!cols'] = [{wch:24},{wch:14},{wch:16},{wch:18},{wch:16},{wch:16},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws3, 'Fittings');

    const fileName = `Pump_Sizing_${res.project.kodeAlat}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initFittings();
    document.getElementById('calculateBtn').addEventListener('click', calculatePump);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    // live update total Le when pipe size changes
    ['suctionPipe','dischargePipe'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            updateFittingTotal(id.replace('Pipe',''));
        });
    });
});
