// routes/tasks.js
const Task = require('../models/task');

module.exports = function (router) {
router.get('/tasks', async function (req, res) {
  const Task = require('../models/task');

  function parseJSON(v) {
    if (!v) return undefined;
    try { return JSON.parse(v); } catch { return undefined; }
  }

  const where  = parseJSON(req.query.where)  || {};
  const sort   = parseJSON(req.query.sort)   || undefined;
  const select = parseJSON(req.query.select) || undefined;

  const skip   = req.query.skip  ? parseInt(req.query.skip, 10)  : 0;
  const limit  = req.query.limit ? parseInt(req.query.limit, 10) : 100;

  const wantCount = String(req.query.count).toLowerCase() === 'true';

  try {
    if (wantCount) {
      const count = await Task.countDocuments(where);
      return res.status(200).json({ message: 'OK', data: count });
    }

    let q = Task.find(where);
    if (sort)   q = q.sort(sort);
    if (select) q = q.select(select);
    if (skip)   q = q.skip(skip);
    if (typeof limit === 'number') q = q.limit(limit);

    const tasks = await q.exec();
    return res.status(200).json({ message: 'OK', data: tasks });
  } catch (err) {
    return res.status(400).json({ message: 'Invalid query parameters', data: {} });
  }
});

  router.post('/tasks', async function (req, res) {
    try {
      const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;

      if (!name || !deadline) {
        return res.status(400).json({ message: 'Task name and deadline are required', data: {} });
      }

      const newTask = new Task({
        name,
        description: description || '',
        deadline, 
        completed: typeof completed === 'boolean' ? completed : false,
        assignedUser: assignedUser || '',
        assignedUserName: assignedUserName || 'unassigned'
      });

      await newTask.save();
      return res.status(201).json({ message: 'Task created', data: newTask });
    } catch (err) {
      return res.status(500).json({ message: 'Server error', data: {} });
    }
  });
router.get('/tasks/:id', async function (req, res) {
  const Task = require('../models/task');

  let select;
  try {
    select = req.query.select ? JSON.parse(req.query.select) : undefined;
  } catch {
    return res.status(400).json({ message: 'Invalid select parameter', data: {} });
  }

  try {
    const q = Task.findById(req.params.id);
    if (select) q.select(select);

    const task = await q.exec();
    if (!task) {
      return res.status(404).json({ message: 'Task not found', data: {} });
    }
    return res.status(200).json({ message: 'OK', data: task });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', data: {} });
  }
});


router.put('/tasks/:id', async function (req, res) {
  const Task = require('../models/task');
  const User = require('../models/user');

  try {
    const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;

    if (!name || !deadline) {
      return res.status(400).json({ message: "Task name and deadline are required", data: {} });
    }

    const existing = await Task.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Task not found", data: {} });
    }

    let newAssignedUser = assignedUser || '';
    let newAssignedUserName = assignedUserName || 'unassigned';

    if (newAssignedUser) {
      const u = await User.findById(newAssignedUser);
      if (!u) {
        return res.status(400).json({ message: "Assigned user does not exist", data: {} });
      }
      newAssignedUserName = u.name;
    } else {
      newAssignedUserName = 'unassigned';
    }

    const replacement = {
      name,
      description: description || '',
      deadline,
      completed: typeof completed === 'boolean' ? completed : false,
      assignedUser: newAssignedUser,
      assignedUserName: newAssignedUserName,
      dateCreated: existing.dateCreated
    };

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      replacement,
      { new: true, runValidators: true, overwrite: true }
    );

    const taskId = String(updated._id);
    const oldUserId = existing.assignedUser || '';
    const newUserId = updated.assignedUser || '';

    if (oldUserId && oldUserId !== newUserId) {
      await User.findByIdAndUpdate(oldUserId, { $pull: { pendingTasks: taskId } });
    }

    if (updated.completed && newUserId) {
      await User.findByIdAndUpdate(newUserId, { $pull: { pendingTasks: taskId } });
    }

    if (!updated.completed && newUserId) {
      await User.findByIdAndUpdate(newUserId, { $addToSet: { pendingTasks: taskId } });
    }

    return res.status(200).json({ message: "OK", data: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", data: {} });
  }
});

router.delete('/tasks/:id', async function (req, res) {
  const Task = require('../models/task');
  const User = require('../models/user');

  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Task not found", data: {} });
    }

    if (existing.assignedUser) {
      await User.findByIdAndUpdate(existing.assignedUser, {
        $pull: { pendingTasks: String(existing._id) }
      });
    }

    await Task.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Task deleted", data: {} });
  } catch (err) {
    return res.status(500).json({ message: "Server error", data: {} });
  }
});

  return router;


};
