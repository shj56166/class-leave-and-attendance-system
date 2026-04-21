async function send(event, options = {}) {
  return {
    provider: 'aliyun_push',
    status: 'skipped',
    reason: 'not_configured',
    eventType: event?.eventType || '',
    teacherIds: options.teacherIds || []
  };
}

module.exports = {
  send
};
