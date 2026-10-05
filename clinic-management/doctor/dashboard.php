<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'doctor') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$doctor_name = $_SESSION['name'];
$today = date('Y-m-d');
$q = mysqli_query($conn, "SELECT id,specialization,avg_consultation_minutes FROM doctors WHERE user_id=$user_id LIMIT 1");
$doctor = mysqli_fetch_assoc($q);
if (!$doctor)
    die('Doctor profile not found.');
$doctor_id = (int) $doctor['id'];
function count_for($conn, $sql)
{
    $r = mysqli_query($conn, $sql);
    $x = mysqli_fetch_assoc($r);
    return (int) $x['total'];
}
$total = count_for($conn, "SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today'");
$waiting = count_for($conn, "SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='waiting'");
$completed = count_for($conn, "SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='completed'");
$sq = mysqli_query($conn, "SELECT a.token_number,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.doctor_id=$doctor_id AND a.appointment_date='$today' AND a.queue_status='serving' LIMIT 1");
$serving = mysqli_fetch_assoc($sq);
$nq = mysqli_query($conn, "SELECT a.token_number,a.appointment_time,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.doctor_id=$doctor_id AND a.appointment_date='$today' AND a.queue_status='waiting' ORDER BY a.token_number ASC LIMIT 1");
$next = mysqli_fetch_assoc($nq);
$up = mysqli_query($conn, "SELECT a.id,a.token_number,a.appointment_time,a.queue_status,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.doctor_id=$doctor_id AND a.appointment_date='$today' ORDER BY a.token_number ASC LIMIT 5");
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Doctor Dashboard | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/doctor.css">
</head>

<body>
    <div class="doctor-dashboard-page">
        <aside class="doctor-sidebar">
            <div class="doctor-brand">
                <div class="doctor-brand-icon"><i class="fa-solid fa-plus"></i></div>
                <div>
                    <h4>ClinicCare</h4><span>Doctor Portal</span>
                </div>
            </div>
            <div class="sidebar-doctor">
                <div class="doctor-avatar"><?php echo strtoupper(substr($doctor_name, 0, 1)); ?></div>
                <div class="doctor-info"><strong>Dr.
                        <?php echo htmlspecialchars($doctor_name); ?></strong><span><?php echo htmlspecialchars($doctor['specialization']); ?></span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-heading">MAIN MENU</div><a href="dashboard.php" class="nav-item active"><i
                        class="fa-solid fa-chart-line"></i><span>Dashboard</span></a><a href="appointments.php"
                    class="nav-item"><i class="fa-solid fa-calendar-check"></i><span>Appointments</span></a><a
                    href="leave.php" class="nav-item"><i class="fa-solid fa-calendar-xmark"></i><span>Manage
                        Leave</span></a>
                <div class="nav-heading">PATIENT CARE</div><a href="appointments.php" class="nav-item"><i
                        class="fa-solid fa-users"></i><span>Patient Queue</span></a>
            </nav>
            <div class="sidebar-bottom"><a href="../auth/logout.php" class="logout-link"><i
                        class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a></div>
        </aside>
        <main class="doctor-main">
            <header class="dashboard-header">
                <div>
                    <div class="breadcrumb">Doctor Portal / Dashboard</div>
                    <h1>Good morning, Dr. <?php echo htmlspecialchars($doctor_name); ?></h1>
                    <p>Here is your schedule and patient activity for today.</p>
                </div>
                <div class="header-date"><span>Today</span><strong><?php echo date('d M Y'); ?></strong></div>
            </header>
            <div class="dashboard-content">
                <div class="doctor-stats-grid">
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon blue"><i class="fa-solid fa-calendar-check"></i></div>
                        <div><span class="doctor-stat-label">Today's Appointments</span><strong
                                class="doctor-stat-number"><?php echo $total; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon orange"><i class="fa-solid fa-hourglass-half"></i></div>
                        <div><span class="doctor-stat-label">Waiting Patients</span><strong
                                class="doctor-stat-number"><?php echo $waiting; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
                        <div><span class="doctor-stat-label">Completed Today</span><strong
                                class="doctor-stat-number"><?php echo $completed; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon purple"><i class="fa-regular fa-clock"></i></div>
                        <div><span class="doctor-stat-label">Avg. Consultation</span><strong
                                class="doctor-stat-number"><?php echo (int) $doctor['avg_consultation_minutes']; ?>
                                min</strong></div>
                    </div>
                </div>
                <div class="admin-dashboard-grid">
                    <section class="cc-card">
                        <div class="cc-card-header">
                            <div>
                                <h2>Live Patient Queue</h2>
                                <p>Current consultation status.</p>
                            </div><span class="cc-badge cc-badge-success">LIVE</span>
                        </div>
                        <div class="cc-card-body"
                            style="text-align:center;min-height:205px;display:flex;flex-direction:column;justify-content:center;align-items:center;">
                            <?php if ($serving) { ?>
                                <div style="color:var(--cc-blue-dark);font-size:10px;font-weight:700;letter-spacing:1px">NOW
                                    SERVING</div>
                                <div style="font-size:45px;font-weight:700;color:var(--cc-navy)">
                                    #<?php echo $serving['token_number']; ?></div>
                                <div style="font-size:16px;font-weight:700;color:var(--cc-navy)">
                                    <?php echo htmlspecialchars($serving['patient_name']); ?></div>
                                <div style="font-size:10px;color:var(--cc-muted)">Patient is currently in consultation.
                                </div><?php } else { ?>
                                <div class="cc-empty-icon"><i class="fa-solid fa-pause"></i></div>
                                <h3>No active consultation</h3>
                                <p>Start a waiting appointment to begin serving.</p><?php } ?>
                        </div>
                        <div
                            style="padding:13px 20px;border-top:1px solid var(--cc-border);display:flex;align-items:center;justify-content:space-between">
                            <div style="font-size:10px;color:var(--cc-muted)"><strong
                                    style="display:block;color:var(--cc-navy)">Next
                                    patient</strong><?php echo $next ? 'Token #' . (int) $next['token_number'] . ' - ' . htmlspecialchars($next['patient_name']) : 'No waiting patients'; ?>
                            </div><a href="appointments.php" class="cc-btn cc-btn-primary">View Queue</a>
                        </div>
                    </section>
                    <section class="cc-card">
                        <div class="cc-card-header">
                            <div>
                                <h2>Quick Actions</h2>
                                <p>Frequently used options.</p>
                            </div>
                        </div>
                        <div style="padding:8px 18px 14px"><a href="appointments.php"
                                style="display:flex;align-items:center;gap:11px;padding:13px 4px;border-bottom:1px solid #EEF2F7">
                                <div class="cc-stat-icon blue"><i class="fa-solid fa-calendar-check"></i></div>
                                <div style="flex:1"><strong
                                        style="display:block;color:var(--cc-navy);font-size:12px">View
                                        Appointments</strong><span style="color:var(--cc-muted);font-size:10px">Manage
                                        today's patients</span></div><i class="fa-solid fa-chevron-right"
                                    style="color:#94A3B8"></i>
                            </a><a href="leave.php" style="display:flex;align-items:center;gap:11px;padding:13px 4px">
                                <div class="cc-stat-icon orange"><i class="fa-solid fa-calendar-xmark"></i></div>
                                <div style="flex:1"><strong
                                        style="display:block;color:var(--cc-navy);font-size:12px">Manage
                                        Leave</strong><span style="color:var(--cc-muted);font-size:10px">Schedule
                                        unavailable dates</span></div><i class="fa-solid fa-chevron-right"
                                    style="color:#94A3B8"></i>
                            </a></div>
                    </section>
                </div>
                <section class="cc-card">
                    <div class="cc-card-header">
                        <div>
                            <h2>Today's Appointments</h2>
                            <p>Your first five appointments for today.</p>
                        </div><a href="appointments.php" class="cc-btn cc-btn-outline">View All</a>
                    </div>
                    <div class="cc-table-wrapper">
                        <table class="cc-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Patient</th>
                                    <th>Time</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody><?php if (mysqli_num_rows($up) > 0) {
                                while ($a = mysqli_fetch_assoc($up)) { ?>
                                        <tr>
                                            <td><span
                                                    class="cc-badge cc-badge-primary">#<?php echo $a['token_number']; ?></span>
                                            </td>
                                            <td>
                                                <div class="cc-person">
                                                    <div class="cc-person-avatar">
                                                        <?php echo strtoupper(substr($a['patient_name'], 0, 1)); ?></div>
                                                    <div class="cc-person-info">
                                                        <strong><?php echo htmlspecialchars($a['patient_name']); ?></strong><span>Patient</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><?php echo date('h:i A', strtotime($a['appointment_time'])); ?></td>
                                            <td><?php $map = ['waiting' => ['cc-badge-warning', 'Waiting'], 'serving' => ['cc-badge-success', 'Serving'], 'completed' => ['cc-badge-primary', 'Completed'], 'skipped' => ['cc-badge-neutral', 'Skipped']];
                                            $m = $map[$a['queue_status']] ?? $map['waiting']; ?><span
                                                    class="cc-badge <?php echo $m[0]; ?>"><?php echo $m[1]; ?></span></td>
                                            <td><a href="patient.php?id=<?php echo $a['id']; ?>"
                                                    class="cc-btn cc-btn-secondary">View</a></td>
                                        </tr><?php }
                            } else { ?>
                                    <tr>
                                        <td colspan="5">
                                            <div class="cc-empty">
                                                <div class="cc-empty-icon"><i class="fa-regular fa-calendar-xmark"></i>
                                                </div>
                                                <h3>No appointments today</h3>
                                                <p>You do not have any appointments scheduled today.</p>
                                            </div>
                                        </td>
                                    </tr><?php } ?>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    </div>
</body>

</html>