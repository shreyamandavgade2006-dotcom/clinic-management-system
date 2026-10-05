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
$q = mysqli_query($conn, "SELECT id FROM doctors WHERE user_id=$user_id LIMIT 1");
$doctor = mysqli_fetch_assoc($q);
if (!$doctor)
    die('Doctor profile not found.');
$doctor_id = (int) $doctor['id'];
if (isset($_POST['start_serving'])) {
    $id = (int) $_POST['appointment_id'];
    $s = mysqli_query($conn, "SELECT id FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='serving' LIMIT 1");
    $_SESSION['doctor_message'] = mysqli_num_rows($s) ? 'Another patient is already being served.' : 'Patient is now being served.';
    if (mysqli_num_rows($s) == 0)
        mysqli_query($conn, "UPDATE appointments SET queue_status='serving',status='confirmed' WHERE id=$id AND doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='waiting'");
    header('Location: appointments.php');
    exit();
}
if (isset($_POST['complete_appointment'])) {
    $id = (int) $_POST['appointment_id'];
    mysqli_query($conn, "UPDATE appointments SET queue_status='completed',status='completed' WHERE id=$id AND doctor_id=$doctor_id AND queue_status='serving'");
    $_SESSION['doctor_message'] = 'Appointment completed.';
    header('Location: appointments.php');
    exit();
}
$count = function ($sql) use ($conn) {
    $r = mysqli_query($conn, $sql);
    return (int) mysqli_fetch_assoc($r)['total']; };
$total = $count("SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today'");
$waiting = $count("SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='waiting'");
$completed = $count("SELECT COUNT(*) total FROM appointments WHERE doctor_id=$doctor_id AND appointment_date='$today' AND queue_status='completed'");
$sq = mysqli_query($conn, "SELECT a.token_number,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.doctor_id=$doctor_id AND a.appointment_date='$today' AND a.queue_status='serving' LIMIT 1");
$serving = mysqli_fetch_assoc($sq);
$aq = mysqli_query($conn, "SELECT a.id,a.token_number,a.appointment_time,a.reason,a.status,a.queue_status,p.phone,u.name patient_name FROM appointments a JOIN patients p ON a.patient_id=p.id JOIN users u ON p.user_id=u.id WHERE a.doctor_id=$doctor_id AND a.appointment_date='$today' ORDER BY a.token_number ASC");
?><!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Appointments | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/doctor.css">
</head>

<body>
    <div class="doctor-page">
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
                        <?php echo htmlspecialchars($doctor_name); ?></strong><span>Doctor</span></div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-heading">MAIN MENU</div><a href="dashboard.php" class="nav-item"><i
                        class="fa-solid fa-chart-line"></i><span>Dashboard</span></a><a href="appointments.php"
                    class="nav-item active"><i class="fa-solid fa-calendar-check"></i><span>Appointments</span></a><a
                    href="leave.php" class="nav-item"><i class="fa-solid fa-calendar-xmark"></i><span>Manage
                        Leave</span></a>
                <div class="nav-heading">PATIENT CARE</div><a href="appointments.php" class="nav-item"><i
                        class="fa-solid fa-users"></i><span>Patient Queue</span></a>
            </nav>
            <div class="sidebar-bottom"><a href="../auth/logout.php" class="logout-link"><i
                        class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a></div>
        </aside>
        <main class="doctor-main">
            <header class="doctor-topbar">
                <div>
                    <div class="doctor-breadcrumb">Doctor Portal / Appointments</div>
                    <h1>Appointments</h1>
                    <p>Manage today's patients and consultation queue.</p>
                </div>
                <div class="doctor-date-box"><span>Today</span><strong><?php echo date('d M Y'); ?></strong></div>
            </header>
            <div class="doctor-content"><?php if (isset($_SESSION['doctor_message'])) { ?>
                    <div class="cc-alert cc-alert-success">
                        <div class="cc-alert-icon" style="background:var(--cc-success);color:#fff"><i
                                class="fa-solid fa-check"></i></div>
                        <span><?php echo htmlspecialchars($_SESSION['doctor_message']);
                        unset($_SESSION['doctor_message']); ?></span>
                    </div><?php } ?>
                <div class="doctor-stats-grid">
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon blue"><i class="fa-solid fa-calendar-check"></i></div>
                        <div><span class="doctor-stat-label">Today's Appointments</span><strong
                                class="doctor-stat-number"><?php echo $total; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon orange"><i class="fa-solid fa-hourglass-half"></i></div>
                        <div><span class="doctor-stat-label">Waiting</span><strong
                                class="doctor-stat-number"><?php echo $waiting; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
                        <div><span class="doctor-stat-label">Completed</span><strong
                                class="doctor-stat-number"><?php echo $completed; ?></strong></div>
                    </div>
                    <div class="doctor-stat-card">
                        <div class="doctor-stat-icon purple"><i class="fa-solid fa-ticket"></i></div>
                        <div><span class="doctor-stat-label">Current Token</span><strong
                                class="doctor-stat-number"><?php echo $serving ? $serving['token_number'] : '-'; ?></strong>
                        </div>
                    </div>
                </div>
                <div class="doctor-queue-card">
                    <div class="doctor-queue-left">
                        <div class="doctor-section-icon"><i class="fa-solid fa-users"></i></div>
                        <div>
                            <div class="doctor-queue-label">LIVE QUEUE</div>
                            <h3>Now serving <?php echo $serving ? 'Token #' . (int) $serving['token_number'] : '-'; ?></h3>
                            <p><?php echo $serving ? htmlspecialchars($serving['patient_name']) . ' is currently in consultation.' : 'No patient is currently being served.'; ?>
                            </p>
                        </div>
                    </div>
                    <div>
                        <?php echo $serving ? '<span class="doctor-serving-badge">SERVING</span>' : '<span class="doctor-idle-badge">IDLE</span>'; ?>
                    </div>
                </div>
                <section class="doctor-panel">
                    <div class="doctor-panel-header">
                        <div>
                            <h2>Today's Appointment List</h2>
                            <p>Patients scheduled for <?php echo date('d M Y'); ?>.</p>
                        </div><span class="cc-badge cc-badge-primary"><?php echo $total; ?> Appointments</span>
                    </div>
                    <div class="doctor-table-wrapper">
                        <table class="doctor-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Patient</th>
                                    <th>Phone</th>
                                    <th>Time</th>
                                    <th>Reason</th>
                                    <th>Queue</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody><?php if (mysqli_num_rows($aq)) {
                                while ($a = mysqli_fetch_assoc($aq)) { ?>
                                        <tr>
                                            <td><span
                                                    class="cc-badge cc-badge-primary">#<?php echo $a['token_number']; ?></span>
                                            </td>
                                            <td>
                                                <div class="patient-cell">
                                                    <div class="patient-avatar">
                                                        <?php echo strtoupper(substr($a['patient_name'], 0, 1)); ?></div>
                                                    <div>
                                                        <strong><?php echo htmlspecialchars($a['patient_name']); ?></strong><small>Patient</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><?php echo htmlspecialchars($a['phone']); ?></td>
                                            <td><?php echo date('h:i A', strtotime($a['appointment_time'])); ?></td>
                                            <td><?php echo $a['reason'] ? htmlspecialchars($a['reason']) : 'General consultation'; ?>
                                            </td>
                                            <td><?php $map = ['waiting' => ['cc-badge-warning', 'Waiting'], 'serving' => ['cc-badge-success', 'Serving'], 'completed' => ['cc-badge-primary', 'Completed'], 'skipped' => ['cc-badge-neutral', 'Skipped']];
                                            $m = $map[$a['queue_status']] ?? $map['waiting']; ?><span
                                                    class="cc-badge <?php echo $m[0]; ?>"><?php echo $m[1]; ?></span></td>
                                            <td>
                                                <div class="appointment-actions"><a
                                                        href="patient.php?id=<?php echo $a['id']; ?>"
                                                        class="doctor-action-btn view">View</a><?php if ($a['queue_status'] == 'waiting' && $a['status'] != 'cancelled') { ?>
                                                        <form method="POST" class="doctor-inline-form"><input type="hidden"
                                                                name="appointment_id" value="<?php echo $a['id']; ?>"><button
                                                                name="start_serving" class="doctor-action-btn start">Start</button>
                                                        </form><?php } elseif ($a['queue_status'] == 'serving') { ?>
                                                        <form method="POST" class="doctor-inline-form"><input type="hidden"
                                                                name="appointment_id" value="<?php echo $a['id']; ?>"><button
                                                                name="complete_appointment"
                                                                class="doctor-action-btn complete">Complete</button></form>
                                                    <?php } ?>
                                                </div>
                                            </td>
                                        </tr><?php }
                            } else { ?>
                                    <tr>
                                        <td colspan="7">
                                            <div class="empty-state">
                                                <div class="empty-state-icon"><i class="fa-regular fa-calendar-xmark"></i>
                                                </div>
                                                <h3>No appointments today</h3>
                                                <p>There are no appointments scheduled today.</p>
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