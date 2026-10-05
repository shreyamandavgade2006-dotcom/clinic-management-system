<?php
session_start();
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'doctor') {
    header('Location: ../auth/login.php');
    exit();
}
include('../config/database.php');
$user_id = (int) $_SESSION['user_id'];
$doctor_name = $_SESSION['name'];
$dq = mysqli_query($conn, "SELECT id,specialization FROM doctors WHERE user_id=$user_id LIMIT 1");
$doctor = mysqli_fetch_assoc($dq);
if (!$doctor)
    die('Doctor profile not found.');
$doctor_id = (int) $doctor['id'];
$today = date('Y-m-d');
if (isset($_POST['add_leave'])) {
    $date = mysqli_real_escape_string($conn, $_POST['leave_date']);
    $reason = mysqli_real_escape_string($conn, trim($_POST['reason']));
    $msg = '';
    $type = 'success';
    if (!$date || $date < $today) {
        $msg = 'Please select today or a future date.';
        $type = 'error';
    } else {
        $check = mysqli_query($conn, "SELECT id FROM doctor_leaves WHERE doctor_id=$doctor_id AND leave_date='$date' LIMIT 1");
        if (mysqli_num_rows($check)) {
            $msg = 'Leave has already been added for this date.';
            $type = 'error';
        } else {
            mysqli_begin_transaction($conn);
            try {
                mysqli_query($conn, "INSERT INTO doctor_leaves(doctor_id,leave_date,reason) VALUES($doctor_id,'$date','$reason')");
                $affected = mysqli_query($conn, "SELECT a.id,a.patient_id FROM appointments a WHERE a.doctor_id=$doctor_id AND a.appointment_date='$date' AND a.status IN('pending','confirmed')");
                while ($a = mysqli_fetch_assoc($affected)) {
                    mysqli_query($conn, "UPDATE appointments SET status='cancelled',queue_status='skipped',cancel_reason='Doctor is unavailable on this date.' WHERE id=" . (int) $a['id']);
                    $note = mysqli_real_escape_string($conn, 'Your appointment with Dr. ' . $doctor_name . ' on ' . date('d M Y', strtotime($date)) . ' has been cancelled because the doctor is unavailable.');
                    mysqli_query($conn, "INSERT INTO notifications(user_id,message,type) SELECT user_id,'$note','doctor_leave' FROM patients WHERE id=" . (int) $a['patient_id']);
                }
                mysqli_commit($conn);
                $msg = 'Leave added successfully. Affected appointments were cancelled.';
            } catch (Exception $e) {
                mysqli_rollback($conn);
                $msg = 'Unable to add leave.';
                $type = 'error';
            }
        }
    }
    $_SESSION['leave_message'] = $msg;
    $_SESSION['leave_type'] = $type;
    header('Location: leave.php');
    exit();
}
$lq = mysqli_query($conn, "SELECT id,leave_date,reason FROM doctor_leaves WHERE doctor_id=$doctor_id AND leave_date>='$today' ORDER BY leave_date ASC");
$count = mysqli_num_rows($lq);
?><!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Manage Leave | ClinicCare</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/doctor.css">
</head>

<body>
    <div class="doctor-leave-page">
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
                <div class="nav-heading">MAIN MENU</div><a href="dashboard.php" class="nav-item"><i
                        class="fa-solid fa-chart-line"></i><span>Dashboard</span></a><a href="appointments.php"
                    class="nav-item"><i class="fa-solid fa-calendar-check"></i><span>Appointments</span></a><a
                    href="leave.php" class="nav-item active"><i class="fa-solid fa-calendar-xmark"></i><span>Manage
                        Leave</span></a>
            </nav>
            <div class="sidebar-bottom"><a href="../auth/logout.php" class="logout-link"><i
                        class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a></div>
        </aside>
        <main class="doctor-main">
            <header class="page-header">
                <div>
                    <div class="breadcrumb">Doctor Portal / Manage Leave</div>
                    <h1>Manage Leave</h1>
                    <p>Schedule dates when you are unavailable for consultations.</p>
                </div>
                <div class="header-date"><span>Today</span><strong><?php echo date('d M Y'); ?></strong></div>
            </header>
            <div class="page-content"><?php if (isset($_SESSION['leave_message'])) { ?>
                    <div
                        class="cc-alert <?php echo $_SESSION['leave_type'] == 'success' ? 'cc-alert-success' : 'cc-alert-danger'; ?>">
                        <div class="cc-alert-icon" style="background:currentColor;color:#fff"><i
                                class="fa-solid fa-info"></i></div>
                        <span><?php echo htmlspecialchars($_SESSION['leave_message']);
                        unset($_SESSION['leave_message']);
                        unset($_SESSION['leave_type']); ?></span>
                    </div><?php } ?>
                <div class="intro-card">
                    <div class="intro-icon"><i class="fa-solid fa-calendar-days"></i></div>
                    <div>
                        <h2>Doctor Availability</h2>
                        <p>Existing appointments on a leave date are cancelled automatically and affected patients
                            receive a notification.</p>
                    </div>
                </div>
                <div class="leave-grid">
                    <section class="cc-card">
                        <div class="cc-card-header">
                            <div>
                                <h2>Add Leave</h2>
                                <p>Mark a date as unavailable.</p>
                            </div>
                        </div>
                        <div class="cc-card-body">
                            <form method="POST">
                                <div class="cc-form-group"><label class="cc-form-label">Leave Date</label><input
                                        type="date" name="leave_date" class="cc-input" min="<?php echo $today; ?>"
                                        required></div>
                                <div class="cc-form-group"><label class="cc-form-label">Reason</label><textarea
                                        name="reason" class="cc-textarea"
                                        placeholder="Example: Personal work, conference, holiday..."></textarea></div>
                                <button name="add_leave" class="cc-btn cc-btn-primary"><i
                                        class="fa-solid fa-calendar-plus"></i>Add Leave</button>
                            </form>
                        </div>
                    </section>
                    <section class="cc-card">
                        <div class="cc-card-header">
                            <div>
                                <h2>Leave Information</h2>
                                <p>What happens when leave is added?</p>
                            </div>
                        </div>
                        <div class="info-list">
                            <div class="info-item">
                                <div class="info-number">01</div>
                                <div><strong>Availability is updated</strong>
                                    <p>The selected date is marked unavailable.</p>
                                </div>
                            </div>
                            <div class="info-item">
                                <div class="info-number">02</div>
                                <div><strong>Appointments are handled</strong>
                                    <p>Pending and confirmed appointments are cancelled.</p>
                                </div>
                            </div>
                            <div class="info-item">
                                <div class="info-number">03</div>
                                <div><strong>Patients are notified</strong>
                                    <p>A notification explains the cancellation.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
                <section class="cc-card">
                    <div class="cc-card-header">
                        <div>
                            <h2>Upcoming Leave</h2>
                            <p>Your scheduled unavailable dates.</p>
                        </div><span class="cc-badge cc-badge-primary"><?php echo $count; ?>
                            Leave<?php echo $count == 1 ? '' : 's'; ?></span>
                    </div>
                    <div><?php if ($count) {
                        while ($l = mysqli_fetch_assoc($lq)) { ?>
                                <div class="leave-row">
                                    <div class="leave-date-box">
                                        <span><?php echo date('M', strtotime($l['leave_date'])); ?></span><strong><?php echo date('d', strtotime($l['leave_date'])); ?></strong><small><?php echo date('Y', strtotime($l['leave_date'])); ?></small>
                                    </div>
                                    <div class="leave-details">
                                        <strong><?php echo date('l, d F Y', strtotime($l['leave_date'])); ?></strong><span><?php echo htmlspecialchars($l['reason'] ?: 'No reason provided'); ?></span>
                                    </div>
                                    <div class="leave-status"><span>Scheduled</span></div>
                                </div><?php }
                    } else { ?>
                            <div class="cc-empty">
                                <div class="cc-empty-icon"><i class="fa-regular fa-calendar"></i></div>
                                <h3>No upcoming leave</h3>
                                <p>You currently have no leave dates scheduled.</p>
                            </div><?php } ?>
                    </div>
                </section>
            </div>
        </main>
    </div>
</body>

</html>