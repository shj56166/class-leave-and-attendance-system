#!/bin/sh

# 数据库备份脚本
# 每天凌晨3点自动执行

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/qingjia_db_$DATE.sql"

echo "开始备份数据库: $DATE"

# 执行备份
mysqldump -h${MYSQL_HOST} -P${MYSQL_PORT} -u${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE} > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "备份成功: $BACKUP_FILE"

  # 压缩备份文件
  gzip $BACKUP_FILE
  echo "压缩完成: ${BACKUP_FILE}.gz"

  # 删除7天前的备份
  find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
  echo "已清理7天前的备份"

  # 保留每周一的备份（最近4周）
  # 删除超过28天的周一备份
  find $BACKUP_DIR -name "*_Monday_*.sql.gz" -mtime +28 -delete

else
  echo "备份失败"
  exit 1
fi

echo "备份任务完成"
