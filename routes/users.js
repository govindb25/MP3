const User = require('../models/user'); // add this line so we can use the model

module.exports = function (router) {
   
    router.get('/users', async function (req, res) {
    const User = require('../models/user');
  
    function parseJSON(v) {
      if (!v) return undefined;
      try { return JSON.parse(v); } catch { return undefined; }
    }
  
    const where  = parseJSON(req.query.where)  || {};
    const sort   = parseJSON(req.query.sort)   || undefined;
    const select = parseJSON(req.query.select) || undefined;
  
    const skip   = req.query.skip  ? parseInt(req.query.skip, 10)  : 0;
    const limit  = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
  
    const wantCount = String(req.query.count).toLowerCase() === 'true';
  
    try {
      if (wantCount) {
        const count = await User.countDocuments(where);
        return res.status(200).json({ message: 'OK', data: count });
      }
  
      let q = User.find(where);
      if (sort)   q = q.sort(sort);
      if (select) q = q.select(select);
      if (skip)   q = q.skip(skip);
      if (typeof limit === 'number') q = q.limit(limit);
  
      const users = await q.exec();
      return res.status(200).json({ message: 'OK', data: users });
    } catch (err) {
      return res.status(400).json({ message: 'Invalid query parameters', data: {} });
    }
  });
  
    router.post('/users', async function (req, res) {
        try {
            const { name, email } = req.body;

            if (!name || !email) {
                return res.status(400).json({ message: "Name and email are required", data: {} });
            }
            const newUser = new User({
                name: name,
                email: email
            });

            await newUser.save();

            return res.status(201).json({ message: "User created", data: newUser });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ message: "Email already exists", data: {} });
            }
            return res.status(500).json({ message: "Server error", data: {} });
        }
    });

    router.get('/users/:id', async function (req, res) {
        const User = require('../models/user');
      
        let select;
        try {
          select = req.query.select ? JSON.parse(req.query.select) : undefined;
        } catch {
          return res.status(400).json({ message: 'Invalid select parameter', data: {} });
        }
      
        try {
          const q = User.findById(req.params.id);
          if (select) q.select(select);
      
          const user = await q.exec();
          if (!user) {
            return res.status(404).json({ message: "User not found", data: {} });
          }
          return res.status(200).json({ message: "OK", data: user });
        } catch (err) {
          return res.status(500).json({ message: "Server error", data: {} });
        }
      });
      router.put('/users/:id', async function (req, res) {
        const User = require('../models/user');
        const Task = require('../models/task');
      
        try {
          const { name, email, pendingTasks } = req.body;
      
          if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required", data: {} });
          }
      
          const existing = await User.findById(req.params.id);
          if (!existing) {
            return res.status(404).json({ message: "User not found", data: {} });
          }
      
          const oldPending = (existing.pendingTasks || []).map(String);
          const newPending = Array.isArray(pendingTasks) ? pendingTasks.map(String) : [];
      
          const removed = oldPending.filter(id => !newPending.includes(id));
          if (removed.length) {
            await Task.updateMany(
              { _id: { $in: removed }, assignedUser: String(existing._id) },
              { $set: { assignedUser: "", assignedUserName: "unassigned" } }
            );
          }
      
          const added = newPending.filter(id => !oldPending.includes(id));
          for (const taskId of added) {
            const t = await Task.findById(taskId);
            if (!t) {
              return res.status(400).json({ message: `Task ${taskId} does not exist`, data: {} });
            }
      
            if (t.assignedUser && String(t.assignedUser) !== String(existing._id)) {
              await User.findByIdAndUpdate(t.assignedUser, { $pull: { pendingTasks: String(t._id) } });
            }
      
            t.assignedUser = String(existing._id);
            t.assignedUserName = name;     
            t.completed = false;
            await t.save();
          }
          const kept = newPending.filter(id => oldPending.includes(id));
          if (kept.length) {
            await Task.updateMany(
              { _id: { $in: kept } },
              { $set: { assignedUser: String(existing._id), assignedUserName: name } }
            );
          }
      
          const replacement = {
            name,
            email,
            pendingTasks: newPending,
            dateCreated: existing.dateCreated
          };
      
          const updated = await User.findByIdAndUpdate(
            req.params.id,
            replacement,
            { new: true, runValidators: true, overwrite: true }
          );
      
          return res.status(200).json({ message: "OK", data: updated });
        } catch (err) {
          if (err.code === 11000) {
            return res.status(400).json({ message: "Email already exists", data: {} });
          }
          return res.status(500).json({ message: "Server error", data: {} });
        }
      });
    router.delete('/users/:id', async function (req, res) {
    const User = require('../models/user');
    const Task = require('../models/task');
  
    try {
      const u = await User.findById(req.params.id);
      if (!u) {
        return res.status(404).json({ message: "User not found", data: {} });
      }
  
      const pending = (u.pendingTasks || []).map(String);
      if (pending.length) {
        await Task.updateMany(
          { _id: { $in: pending }, assignedUser: String(u._id) },
          { $set: { assignedUser: "", assignedUserName: "unassigned" } }
        );
      }
  
      await User.findByIdAndDelete(req.params.id);
      return res.status(200).json({ message: "User deleted", data: {} });
    } catch (err) {
      return res.status(500).json({ message: "Server error", data: {} });
    }
  });
  
    return router; 
};
